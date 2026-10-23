// ─── New Case Flow · case-level steps ────────────────────────────────────────
// Patient, Lab, Scans Source, Prescriber and Delivery. Each shows what Smile
// Genius already knows as a settled row with its source tag, and only asks
// when something is missing. With room to spare ('wide': Guided, Conversation)
// the same answers draw as cards with the context around them: the patient's
// past work, the scan's arches, the signing line, the dates journey. One page
// ('compact') keeps the plain rows.

import { forwardRef, useCallback, useEffect, useRef, useState, DragEvent, ForwardedRef, KeyboardEvent, ReactNode } from 'react';
import {
  BadgeCheck, Box, Building2, CalendarCheck, CalendarDays, Check, CircleDashed, Clock3, FileUp, HeartPulse, History, Layers, Lock,
  Package, Palette, PenLine, ScanLine, Search, Send, Smile, SprayCan, Star, Stethoscope, Truck, Upload, UserRound, Wallet, Zap,
  Anchor, type LucideIcon,
} from 'lucide-react';
import { useCase } from './CaseContext';
import { CLINIC, DENTISTS, LABS, LabId, Patient, PriorWork, User, labById } from './data';
import { demoNow, fmtCutoff, fmtDay, fmtFull, fmtMonth, fmtShort, fmtTime, fromISO, sameDay } from './dates';
import {
  BOX_ITEMS, PRODUCTS, archWord, attestation, defaultBox, fastTrackEligible, fitCheck, fitLine, fullName, guessFileRole, isPosted,
  itemPhrase, labMakes, labProducts, labSees, optionName, patientAge, patientLine, plural, recordsState, sendMode,
  shadeSwatch, splitSuggestion, teethText, toothText, userTitle, FileRole, type ServiceItem,
} from './rules';
import { learnLogin, toggleFavourite, useFlowStore } from './store';
import { Card, ChoiceChips, LinkButton, Notice, PrimaryButton, SecondaryButton, Segmented, SourceTag, StepHeading, FOCUS, GRADIENT_BTN } from './ui';
import { NoteView, PRODUCT_ICON } from './ServiceSteps';
import { useRoom } from './room';
import PatientPicker from './PatientLauncher';

/** A settled answer: ✓ value · source tag · action. */
export function Settled({ children, src, action, sub }: { children: React.ReactNode; src?: string; action?: React.ReactNode; sub?: React.ReactNode }) {
  return (
    <div className="flex items-start gap-3 px-4 py-3.5 rounded-xl bg-white border border-[#E0E0E6]">
      <span className="mt-0.5 w-5 h-5 rounded-full bg-[#2E7D32] text-white flex items-center justify-center flex-shrink-0" aria-hidden><Check className="w-3 h-3" strokeWidth={3} /></span>
      <div className="flex-1 min-w-0">
        <div className="flex items-center gap-2 flex-wrap">
          <p className="text-sm font-semibold text-[#030213]">{children}</p>
          <SourceTag src={src} />
        </div>
        {sub && <div className="text-xs text-[#4A4A5A] mt-1">{sub}</div>}
      </div>
      {action}
    </div>
  );
}

// ─── Patient ─────────────────────────────────────────────────────────────────

export const PatientStep = forwardRef<HTMLHeadingElement>(function PatientStep(_, ref) {
  const { patient, ctx, draft, openLauncher, setFunding, readOnly, pickingPatient, closePatientPicker, changePatient, user } = useCase();
  const wide = useRoom() === 'wide';
  // Closing the picker unmounts whatever had focus: hand it back to the heading.
  const heading = useRef<HTMLHeadingElement | null>(null);
  const setHeading = useCallback((el: HTMLHeadingElement | null) => { heading.current = el; assignRef(ref, el); }, [ref]);
  const wasPicking = useRef(pickingPatient);
  useEffect(() => {
    if (wasPicking.current && !pickingPatient) heading.current?.focus();
    wasPicking.current = pickingPatient;
  }, [pickingPatient]);

  // Changing patient happens right here, on the page.
  if (pickingPatient && !readOnly) {
    return (
      <div className="space-y-4">
        <StepHeading ref={setHeading} kicker="Patient" title="Who is this case for?" icon={UserRound}>Currently {patient.first} {patient.last}. Pick someone else, or cancel to keep them.</StepHeading>
        <PatientPicker mode="change" user={user} onClose={closePatientPicker} onOpenDraft={() => {}} onPick={changePatient} />
      </div>
    );
  }
  if (wide) {
    return (
      <div>
        <StepHeading ref={setHeading} kicker="Patient" title="Who is this case for?" icon={UserRound} />
        <div className="grid gap-4 lg:grid-cols-2 items-start">
          <PatientHero />
          <PatientWork />
        </div>
      </div>
    );
  }
  return (
    <div className="space-y-5">
      <StepHeading ref={setHeading} kicker="Patient" title="Who is this case for?" icon={UserRound} />
      <Settled
        src={draft.scan ? 'From scan' : 'Patient record'}
        sub={<>The lab sees: <span className="font-semibold text-[#030213]">{labSees(patient, ctx.now)}</span></>}
        action={!readOnly && <SecondaryButton onClick={openLauncher}>Change</SecondaryButton>}
      >
        {patientLine(patient, ctx.now)}
      </Settled>
      {CLINIC.nhsContract && (
        <div>
          <p className="text-xs font-semibold text-[#3A3A4A] mb-2">Funding</p>
          <Segmented label="Funding" value={draft.funding} disabled={readOnly} onChange={f => setFunding(f)} options={[{ id: 'private', label: 'Private' }, { id: 'nhs', label: 'NHS' }]} />
        </div>
      )}
      <p className="text-xs text-[#5A5A6A]">Labs see initials, age, sex and the patient ID. Your group controls this.</p>
    </div>
  );
});

const SEX_WORD: Record<Patient['sex'], string> = { F: 'Female', M: 'Male', X: 'Sex not stated' };
const FUNDING: { id: 'private' | 'nhs'; label: string; icon: LucideIcon }[] = [
  { id: 'private', label: 'Private', icon: Wallet },
  { id: 'nhs', label: 'NHS', icon: HeartPulse },
];

/** Who the case is for, what the lab sees of them, and how it's funded. */
function PatientHero() {
  const { patient, ctx, draft, openLauncher, setFunding, readOnly } = useCase();
  return (
    <div className="rounded-2xl border border-[#E0E0E6] bg-white p-5">
      <div className="flex items-start gap-4">
        <Avatar text={`${patient.first[0]}${patient.last[0]}`} />
        <div className="flex-1 min-w-0">
          <div className="flex items-center gap-2 flex-wrap">
            <p className="text-base font-semibold text-[#030213]">{fullName(patient)}</p>
            <SourceTag src={draft.scan ? 'From scan' : 'Patient record'} />
          </div>
          <p className="mt-0.5 text-xs text-[#4A4A5A]">{SEX_WORD[patient.sex]} · {patientAge(patient, ctx.now)} years · {patient.id}</p>
          <p className="text-xs text-[#5A5A6A]">DOB {patient.dob}</p>
        </div>
        {!readOnly && <SecondaryButton onClick={openLauncher}>Change</SecondaryButton>}
      </div>
      <div className="mt-4 flex items-start gap-2.5 px-3 py-2.5 rounded-xl bg-[#F8F9FC] border border-[#ECECF2]">
        <Lock className="w-3.5 h-3.5 mt-0.5 flex-shrink-0 text-[#5A5A6A]" strokeWidth={1.75} aria-hidden />
        <p className="min-w-0 text-xs text-[#4A4A5A]">
          Labs see <span className="font-semibold text-[#030213]">{labSees(patient, ctx.now)}</span>
          <span className="block text-[11px] text-[#5A5A6A] mt-0.5">Initials, age, sex and the patient ID only. Your group controls this.</span>
        </p>
      </div>
      {CLINIC.nhsContract && (
        <div className="mt-4 pt-4 border-t border-[#F0EFF6] flex items-center justify-between gap-3 flex-wrap">
          <p className="text-xs font-semibold text-[#3A3A4A]">Funding</p>
          <IconSegmented label="Funding" value={draft.funding} disabled={readOnly} onChange={f => setFunding(f)} options={FUNDING} />
        </div>
      )}
    </div>
  );
}

/** The patient's last few lab cases, and what's on record that shapes this one. */
function PatientWork() {
  const { patient, user } = useCase();
  const n = user.notation;
  const work = [...(patient.history ?? [])].sort((a, b) => b.date.localeCompare(a.date)).slice(0, 3);
  const strong = (s: string) => <span className="font-semibold text-[#030213]">{s}</span>;
  const facts: { key: string; icon: LucideIcon; text: ReactNode }[] = [];
  const ns = patient.nextStage;
  if (ns) facts.push({ key: 'next', icon: PRODUCT_ICON.denture, text: <>Next stage {strong(optionName('denture', ns.stage))} · {archWord(ns.arch)} full denture · {ns.note}</> });
  if (patient.repeat) facts.push({ key: 'repeat', icon: History, text: <>Can repeat {strong(patient.repeat.label)}</> });
  for (const im of patient.implants ?? []) {
    facts.push({ key: `imp-${im.tooth}`, icon: Anchor, text: <>Implant {strong(toothText(im.tooth, n))} · {im.system} {im.platform} {im.diameter} · placed {fmtFull(fromISO(im.placed))}</> });
  }
  if (patient.missing?.length) facts.push({ key: 'missing', icon: CircleDashed, text: <>Missing {strong(teethText(patient.missing, n))}</> });
  if (patient.lastShade && !work.some(w => w.shade === patient.lastShade)) facts.push({ key: 'shade', icon: Palette, text: <>Last shade {strong(patient.lastShade)}</> });

  return (
    <section aria-labelledby="nc-recent-work" className="rounded-2xl border border-[#ECECF2] bg-[#F8F9FC] p-4">
      <div className="flex items-center gap-2 mb-3">
        <History className="w-4 h-4 text-[#4A4A5A]" strokeWidth={1.75} aria-hidden />
        <h3 id="nc-recent-work" className="text-xs font-semibold text-[#3A3A4A]">Recent lab work</h3>
        {work.length > 0 && <span className="ml-auto text-[11px] text-[#5A5A6A]">{plural(patient.history!.length, 'case')}</span>}
      </div>
      {work.length > 0 ? (
        <ul className="space-y-2">{work.map(w => <WorkRow key={w.caseId} work={w} />)}</ul>
      ) : (
        <p className="px-3 py-3 rounded-xl bg-white border border-dashed border-[#E0E0E6] text-xs text-[#5A5A6A]">No lab work on record for {patient.first} yet.</p>
      )}
      {facts.length > 0 && (
        <ul className="mt-3 pt-3 border-t border-[#ECECF2] space-y-1.5">
          {facts.map(({ key, icon: Icon, text }) => (
            <li key={key} className="flex items-start gap-2 text-xs text-[#4A4A5A]">
              <Icon className="w-3.5 h-3.5 mt-px flex-shrink-0 text-[#2F62D6]" strokeWidth={1.75} aria-hidden />
              <span className="min-w-0">{text}</span>
            </li>
          ))}
        </ul>
      )}
    </section>
  );
}

function WorkRow({ work: w }: { work: PriorWork }) {
  const { user } = useCase();
  const Icon = PRODUCT_ICON[w.product];
  const where = w.teeth?.length ? teethText(w.teeth, user.notation) : w.arch ? cap(archWord(w.arch)) : '';
  const spec = [w.option && optionName(w.product, w.option), labById(w.lab).name].filter(Boolean).join(' · ');
  return (
    <li className="flex items-center gap-3 px-3 py-2 rounded-xl bg-white border border-[#ECECF2]">
      <span className="w-8 h-8 rounded-lg bg-[#EEF4FF] text-[#2F62D6] flex items-center justify-center flex-shrink-0" aria-hidden><Icon className="w-4 h-4" strokeWidth={1.75} /></span>
      <span className="flex-1 min-w-0">
        <span className="flex items-center gap-1.5 min-w-0">
          <span className="text-sm font-semibold text-[#030213] truncate">{PRODUCTS[w.product].label}{where ? ` · ${where}` : ''}</span>
          {w.open && <SourceTag src="Open" />}
        </span>
        <span className="flex items-center gap-1.5 min-w-0 text-[11px] text-[#4A4A5A]">
          {w.shade && <><span className="w-2.5 h-2.5 rounded-full border border-black/10 flex-shrink-0" style={{ background: shadeSwatch(w.shade) }} aria-hidden />{w.shade} ·</>}
          <span className="truncate">{spec}</span>
        </span>
      </span>
      <span className="text-[11px] text-[#5A5A6A] whitespace-nowrap">{w.open ? 'Sent ' : ''}{fmtMonth(fromISO(w.date))}</span>
    </li>
  );
}

// ─── Lab ─────────────────────────────────────────────────────────────────────

const pluralNoun = (n: string) => (n.endsWith('s') ? n : n === 'something else' ? '' : `${n}s`);
export function labSummary(labId: LabId) {
  const lab = LABS.find(l => l.id === labId)!;
  const nouns = labProducts(lab).filter(p => p !== 'other').map(p => pluralNoun(PRODUCTS[p].noun)).filter(Boolean);
  return `Makes ${nouns.slice(0, 3).join(', ')}${nouns.length > 3 ? '…' : ''}`;
}

export const LabStep = forwardRef<HTMLHeadingElement>(function LabStep(_, ref) {
  const { draft, lab, changeLab, readOnly, dates } = useCase();
  const wide = useRoom() === 'wide';
  const picked = draft.labPicked !== false;
  const { favourites } = useFlowStore();
  const [tab, setTab] = useState<'fav' | 'all'>('all');
  const [q, setQ] = useState('');
  const query = q.trim().toLowerCase();
  const list = LABS
    .filter(l => (tab === 'all' || favourites.includes(l.id)) && (!query || `${l.name} ${l.address}`.toLowerCase().includes(query)))
    .sort((x, y) => Number(y.id === lab.id) - Number(x.id === lab.id));
  return (
    <div>
      <StepHeading ref={ref} kicker="Lab" title="Select Lab to proceed" icon={Building2}>
        Services, materials and dates all come from the lab’s own catalogue.
      </StepHeading>
      {/* The picked lab's working facts, on one slim line. */}
      {wide && picked && (
        <div className="mb-4 flex items-center gap-2 px-3.5 py-2 rounded-xl bg-[#F8F9FC] border border-[#ECECF2] text-xs text-[#4A4A5A] whitespace-nowrap overflow-hidden">
          <span className={`w-6 h-6 rounded-md flex items-center justify-center text-[9px] font-bold flex-shrink-0 ${lab.avatar}`} aria-hidden>{lab.initials}</span>
          <span className="min-w-0 truncate font-semibold text-[#030213]">{lab.name}</span>
          <Fact icon={Clock3}>Cut-off {fmtCutoff(lab.cutoffMin)}</Fact>
          {dates.backBy && dates.route !== 'follow' && <Fact icon={Truck}>Back by {fmtDay(dates.backBy)}</Fact>}
          {lab.fastTrack && <Fact icon={Zap}>Fast-Track</Fact>}
          <Fact>{lab.nhs ? 'NHS and private' : 'Private only'}</Fact>
        </div>
      )}
      <div className="flex items-center border border-[#D4D4DD] rounded-lg overflow-hidden focus-within:border-[#3F6FE8] mb-4 bg-white">
        <Search className="w-4 h-4 text-[#6B6B7B] ml-3" aria-hidden />
        <input value={q} onChange={e => setQ(e.target.value)} placeholder="Find the right lab for your needs.." aria-label="Find a lab" className="flex-1 px-2 py-2.5 text-sm outline-none" />
      </div>
      <div role="tablist" className="flex items-center gap-6 border-b border-[#F0EFF6] mb-4">
        {(['fav', 'all'] as const).map(t => (
          <button key={t} role="tab" aria-selected={tab === t} type="button" onClick={() => setTab(t)} className={`pb-2 -mb-px text-sm font-medium border-b-2 ${FOCUS} ${tab === t ? 'text-[#030213] border-[#030213]' : 'text-[#5A5A6A] border-transparent hover:text-[#030213]'}`}>
            {t === 'fav' ? 'Favourite labs' : 'All labs'}
          </button>
        ))}
      </div>
      {/* A compact list (name, address, star) so many labs fit at once. The suggested lab
          (clinic's usual, or the one that made the previous stage) is listed first. */}
      <div role="radiogroup" aria-label="Lab" className="max-h-[420px] overflow-y-auto rounded-xl border border-[#E0E0E6] divide-y divide-[#F0EFF6] bg-white">
        {list.map(l => {
          const blocker = draft.items.find(i => !labMakes(l, i.product));
          const selected = picked && l.id === lab.id;
          const fav = favourites.includes(l.id);
          return (
            <div key={l.id} className={`flex items-center gap-3 px-4 py-3 ${selected ? 'bg-[#EEF4FF]' : blocker ? 'bg-[#FAFAFB]' : 'hover:bg-[#F8FAFF]'}`}>
              <button
                type="button"
                role="radio"
                aria-checked={selected}
                aria-disabled={!!blocker || readOnly || undefined}
                aria-describedby={blocker ? `lab-block-${l.id}` : undefined}
                onClick={() => { if (!blocker && !readOnly) changeLab(l.id); }}
                className={`flex-1 min-w-0 flex items-center gap-3 text-left rounded-lg ${blocker || readOnly ? 'cursor-not-allowed' : ''} ${FOCUS}`}
              >
                <span className={`w-4 h-4 rounded-full border-2 flex items-center justify-center flex-shrink-0 ${selected ? 'border-[#3F6FE8]' : 'border-[#B8B8C6]'}`} aria-hidden>
                  {selected && <span className="w-2 h-2 rounded-full bg-[#3F6FE8]" />}
                </span>
                <span className="min-w-0">
                  <span className={`block text-sm font-semibold truncate ${blocker ? 'text-[#6B6B7B]' : 'text-[#030213]'}`}>{l.name}</span>
                  <span className="block text-xs text-[#4A4A5A] truncate">{l.address}</span>
                  {blocker && <span id={`lab-block-${l.id}`} className="block text-[11px] text-[#9A3412] mt-0.5">Doesn’t make the {PRODUCTS[blocker.product].noun} in this case.</span>}
                </span>
              </button>
              <button type="button" onClick={() => toggleFavourite(l.id)} aria-pressed={fav} aria-label={fav ? `Remove ${l.name} from favourites` : `Add ${l.name} to favourites`} className={`p-1.5 rounded hover:bg-white flex-shrink-0 ${FOCUS}`}>
                <Star className={`w-4 h-4 ${fav ? 'fill-[#F59E0B] text-[#F59E0B]' : 'text-[#8B8B9E]'}`} />
              </button>
            </div>
          );
        })}
        {list.length === 0 && <p className="px-4 py-10 text-center text-sm text-[#5A5A6A]">{tab === 'fav' ? 'No favourite labs yet. Star a lab from All labs.' : 'No labs match your search.'}</p>}
      </div>
    </div>
  );
});

// ─── Scans Source ────────────────────────────────────────────────────────────

const ROUTES = [
  { id: 'follow', label: 'Scan to Follow', sub: 'Send now; the next scan attaches' },
  { id: 'post', label: 'Impression by Post', sub: 'Adds 1 courier working day' },
  { id: 'upload', label: 'Upload Files', sub: 'STL, PLY, OBJ or DCM' },
];
const ROUTE_ICON: Record<string, LucideIcon> = { follow: Clock3, post: Package, upload: Upload };

export function recordsSummary(api: ReturnType<typeof useCase>): string {
  const { draft, ctx } = api;
  const s = recordsState(draft, ctx);
  if (s === 'scan' && draft.scan) {
    const a = draft.scan.arches;
    const parts = [a.upper && 'upper', a.lower && 'lower', a.bite && 'bite'].filter(Boolean) as string[];
    const txt = parts.length === 3 ? 'Upper, lower and bite' : parts.join(' and ');
    return `${txt.charAt(0).toUpperCase()}${txt.slice(1)} · ${draft.scan.scanner} · today ${draft.scan.time}`;
  }
  if (s === 'nextStage') return 'Models at the lab · box by post';
  if (s === 'post') return 'Impression by post';
  if (s === 'follow') return 'Scan to follow';
  if (s === 'upload') return draft.records.files.length ? `${plural(draft.records.files.length, 'file')} uploaded` : 'Upload files';
  return 'Not chosen yet';
}

export const RecordsStep = forwardRef<HTMLHeadingElement>(function RecordsStep(_, ref) {
  const api = useCase();
  const { draft, ctx, update, openDrawer, patient, readOnly } = api;
  const wide = useRoom() === 'wide';
  const s = recordsState(draft, ctx);
  const setRoute = (route?: 'follow' | 'post' | 'upload') => update(d => ({ ...d, records: { ...d.records, route } }));
  const nextStage = draft.items.find(i => i.stageSrc === 'Next stage');
  const reline = draft.items.some(i => i.product === 'reline');

  return (
    <div className="space-y-5">
      <StepHeading ref={ref} kicker="Scans Source" title={s === 'none' ? 'How will the lab get the impressions?' : 'Scans and impressions'} icon={ScanLine} />
      {s === 'scan' && (wide ? <ScanCard /> : (
        <Settled src="From scan" action={<SecondaryButton onClick={() => openDrawer({ kind: 'scan' })}>View</SecondaryButton>}>{recordsSummary(api)}</Settled>
      ))}
      {s === 'none' && (wide ? (
        <RouteCards value={draft.records.route} onPick={id => setRoute(id as 'follow' | 'post' | 'upload')} />
      ) : (
        <ChoiceChips label="How will the lab get the impressions?" value={draft.records.route} onChange={id => setRoute(id as 'follow' | 'post' | 'upload')} options={ROUTES} />
      ))}
      {s === 'follow' && (
        <>
          <Settled src="You" action={!readOnly && <SecondaryButton onClick={() => setRoute(undefined)}>Change</SecondaryButton>}>Scan to follow</Settled>
          {wide ? <FollowSteps first={patient.first} /> : (
            <p className="text-sm text-[#3A3A4A] leading-relaxed">Send now. The lab can read the prescription straight away, and the next scan from your scanners for {patient.first} attaches to this case. You’ll confirm it before it goes to the lab.</p>
          )}
        </>
      )}
      {s === 'nextStage' && nextStage && patient.nextStage && (
        <Settled src="Next stage">The lab has the models from {patient.nextStage.caseId} · {LABS.find(l => l.id === patient.nextStage!.lab)!.name}</Settled>
      )}
      {isPosted(s) && (
        <PostBox reline={reline} canChange={s === 'post' && !draft.items.every(i => ['denture', 'partial', 'reline'].includes(i.product)) && !readOnly} onChange={() => setRoute(undefined)} />
      )}
      {s === 'upload' && <UploadBox onChange={() => setRoute(undefined)} />}
      {s !== 'scan' && s !== 'none' && draft.items.every(i => ['denture', 'partial', 'reline'].includes(i.product)) && draft.items.length > 0 && (
        <p className="text-xs text-[#5A5A6A]">Dentures and relines always go by post.</p>
      )}
    </div>
  );
});

const ARCH_PART = { upper: 'Upper', lower: 'Lower', bite: 'Bite' } as const;

/** The scan that came in: scanner, time, which arches it holds, and when the lab has it. */
function ScanCard() {
  const { draft, openDrawer, dates, lab, ctx } = useCase();
  const scan = draft.scan!;
  const login = draft.login?.split(':')[1];
  return (
    <div className="rounded-2xl border border-[#E0E0E6] bg-white">
      <div className="flex items-center gap-3 px-5 pt-5">
        <span className="w-10 h-10 rounded-xl bg-[#EEF4FF] text-[#2F62D6] flex items-center justify-center flex-shrink-0" aria-hidden><ScanLine className="w-5 h-5" strokeWidth={1.75} /></span>
        <div className="flex-1 min-w-0">
          <div className="flex items-center gap-2 flex-wrap">
            <span className="inline-flex items-center px-2 py-0.5 rounded-md bg-[#EEF4FF] border border-[#DCE6FD] text-xs font-semibold text-[#1E40AF]">{scan.scanner}</span>
            <p className="text-sm font-semibold text-[#030213]">Scanned today {scan.time}</p>
            <SourceTag src="From scan" />
          </div>
          {login && <p className="mt-0.5 text-xs text-[#4A4A5A]">From the {scan.scanner} login {login}</p>}
        </div>
        <SecondaryButton onClick={() => openDrawer({ kind: 'scan' })}>View</SecondaryButton>
      </div>
      <ul aria-label="In the scan" className="grid grid-cols-3 gap-3 px-5 pt-4 pb-5">
        {(['upper', 'lower', 'bite'] as const).map(part => {
          const on = scan.arches[part];
          return (
            <li key={part} className={`flex items-center gap-3 px-3 py-2.5 rounded-xl border ${on ? 'border-[#BBF7D0] bg-[#F0FDF4]' : 'border-dashed border-[#E0E0E6] bg-[#FAFAFB]'}`}>
              <ArchGlyph part={part} className={`w-8 h-6 flex-shrink-0 ${on ? 'text-[#2E7D32]' : 'text-[#B8B8C6]'}`} />
              <span className="flex-1 min-w-0">
                <span className={`block text-sm font-semibold ${on ? 'text-[#030213]' : 'text-[#6B6B7B]'}`}>{ARCH_PART[part]}</span>
                <span className="block text-[11px] text-[#4A4A5A]">{on ? 'In the scan' : 'Not in the scan'}</span>
              </span>
              {on && <Check className="w-4 h-4 text-[#2E7D32] flex-shrink-0" strokeWidth={2.5} aria-hidden />}
            </li>
          );
        })}
      </ul>
      {dates.received && (
        <p className="flex items-center gap-2 px-5 py-2.5 border-t border-[#F0EFF6] text-xs text-[#4A4A5A]">
          <Send className="w-3.5 h-3.5 text-[#5A5A6A]" strokeWidth={1.75} aria-hidden />
          Goes digitally · {lab.name} receives it {sameDay(dates.received, ctx.now) ? 'today' : fmtDay(dates.received)} · no box to post
        </p>
      )}
    </div>
  );
}

/** No records yet: the three routes as small option cards (a radiogroup). */
function RouteCards({ value, onPick }: { value?: string; onPick: (id: string) => void }) {
  return (
    <div role="radiogroup" aria-label="How will the lab get the impressions?" onKeyDown={roveRadios} className="grid grid-cols-3 gap-3">
      {ROUTES.map((r, i) => {
        const Icon = ROUTE_ICON[r.id];
        const selected = value === r.id;
        return (
          <button
            key={r.id}
            type="button"
            role="radio"
            aria-checked={selected}
            aria-label={`${r.label}, ${r.sub}`}
            title={r.sub}
            tabIndex={selected || (!ROUTES.some(x => x.id === value) && i === 0) ? 0 : -1}
            onClick={() => onPick(r.id)}
            className={`flex items-center gap-3 px-3.5 py-2.5 rounded-xl border text-left transition-colors motion-reduce:transition-none ${FOCUS} ${selected ? 'bg-[#EEF4FF] border-[#3F6FE8] ring-1 ring-[#3F6FE8]' : 'bg-white border-[#D4D4DD] hover:border-[#3F6FE8] hover:bg-[#F8FAFF]'}`}
          >
            <span className="w-8 h-8 rounded-lg bg-[#EEF4FF] border border-[#DCE6FD] text-[#2F62D6] flex items-center justify-center flex-shrink-0" aria-hidden><Icon className="w-4 h-4" strokeWidth={1.75} /></span>
            <span className="flex-1 min-w-0">
              <span className="flex items-center gap-1.5 text-sm font-semibold text-[#030213]">{r.label}{selected && <Check className="w-3.5 h-3.5 text-[#2F62D6]" strokeWidth={3} aria-hidden />}</span>
              <span className="block text-[11px] leading-snug text-[#5A5A6A]">{r.sub}</span>
            </span>
          </button>
        );
      })}
    </div>
  );
}

/** Scan to follow, as the three things that happen. */
function FollowSteps({ first }: { first: string }) {
  const steps: { icon: LucideIcon; title: string; sub: string }[] = [
    { icon: Send, title: 'Send now', sub: 'The lab can read the prescription straight away' },
    { icon: ScanLine, title: 'The next scan attaches', sub: `From your scanners, for ${first}` },
    { icon: BadgeCheck, title: 'You confirm it', sub: 'Before it goes to the lab' },
  ];
  return (
    <ol className="grid grid-cols-3 gap-3">
      {steps.map(({ icon: Icon, title, sub }, i) => (
        <li key={title} className="rounded-xl bg-[#F8F9FC] border border-[#ECECF2] p-3.5">
          <span className="flex items-center gap-2">
            <span className="w-7 h-7 rounded-lg bg-white border border-[#DCE6FD] text-[#2F62D6] flex items-center justify-center" aria-hidden><Icon className="w-4 h-4" strokeWidth={1.75} /></span>
            <span className="text-[10px] font-bold uppercase tracking-widest text-[#5A5A6A]">Step {i + 1}</span>
          </span>
          <p className="mt-2 text-sm font-semibold text-[#030213]">{title}</p>
          <p className="mt-0.5 text-[11px] text-[#4A4A5A]">{sub}</p>
        </li>
      ))}
    </ol>
  );
}

function PostBox({ reline, canChange, onChange }: { reline: boolean; canChange: boolean; onChange: () => void }) {
  const { draft, update, user, readOnly } = useCase();
  const wide = useRoom() === 'wide';
  const box = { ...defaultBox(draft), ...draft.records.box };
  const toggle = (k: string) => update(d => ({ ...d, records: { ...d.records, box: { ...box, [k]: !box[k] } } }));
  const tick = (v: boolean) => {
    const now = demoNow();
    update(d => ({ ...d, records: { ...d.records, disinfected: v, disinfectedAt: v ? `${fmtShort(now)} ${fmtTime(now)}` : undefined, disinfectedBy: v ? user.name : undefined } }));
  };
  const inBox = BOX_ITEMS.filter(k => box[k] || (reline && k === 'Old denture')).length;
  return (
    <div className="space-y-4">
      {canChange && <Settled src="You" action={<SecondaryButton onClick={onChange}>Change</SecondaryButton>}>Impression by post · adds 1 courier working day</Settled>}
      <Card className={wide ? 'p-5' : 'p-4'}>
        {wide ? (
          <div className="flex items-center gap-3 mb-4">
            <span className="w-8 h-8 rounded-lg bg-[#EEF4FF] text-[#2F62D6] flex items-center justify-center flex-shrink-0" aria-hidden><Box className="w-4 h-4" strokeWidth={1.75} /></span>
            <p className="flex-1 text-sm font-semibold text-[#030213]">What’s going in the box?</p>
            <span className="text-[11px] text-[#5A5A6A]">{plural(inBox, 'item')} ticked</span>
          </div>
        ) : (
          <p className="text-sm font-semibold text-[#030213] mb-3 flex items-center gap-2"><Box className="w-4 h-4 text-[#4A4A5A]" aria-hidden />What’s going in the box?</p>
        )}
        <div className="grid grid-cols-2 gap-2">
          {BOX_ITEMS.map(k => {
            const locked = reline && k === 'Old denture';
            return (
              <label key={k} className={`flex items-center gap-2.5 px-3 ${wide ? 'py-2.5 rounded-xl' : 'py-2 rounded-lg'} border ${box[k] ? 'border-[#C8D8FC] bg-[#F5F8FF]' : 'border-[#E0E0E6]'} ${locked ? 'cursor-not-allowed' : 'cursor-pointer'}`}>
                <input type="checkbox" checked={!!box[k] || locked} disabled={locked || readOnly} onChange={() => toggle(k)} className="w-4 h-4 accent-[#3F6FE8]" />
                {wide && <BoxGlyph item={k} on={!!box[k] || locked} />}
                <span className="text-sm text-[#1F1F2E]">{k}</span>
                {locked && <span className="ml-auto inline-flex items-center gap-1 text-[10px] font-semibold text-[#4A4A5A]"><Lock className="w-3 h-3" aria-hidden />Required for this work</span>}
              </label>
            );
          })}
        </div>
      </Card>
      <label className={`flex items-start gap-3 px-4 py-3.5 rounded-xl border-2 cursor-pointer ${draft.records.disinfected ? 'border-[#86C99A] bg-[#F0FDF4]' : 'border-[#F5D98B] bg-[#FFFBEB]'} focus-within:ring-2 focus-within:ring-[#3F6FE8]`}>
        <input type="checkbox" checked={draft.records.disinfected} disabled={readOnly} onChange={e => tick(e.target.checked)} className="mt-0.5 w-4 h-4 accent-[#2E7D32]" aria-describedby="disinfect-help" />
        {wide && (
          <span className={`w-8 h-8 rounded-lg flex items-center justify-center flex-shrink-0 bg-white border ${draft.records.disinfected ? 'border-[#BBF7D0] text-[#2E7D32]' : 'border-[#F5D98B] text-[#B45309]'}`} aria-hidden>
            <SprayCan className="w-4 h-4" strokeWidth={1.75} />
          </span>
        )}
        <span className={wide ? 'min-w-0' : undefined}>
          <span className="block text-sm font-semibold text-[#030213]">I’ve disinfected everything in the box with {CLINIC.disinfectant}</span>
          <span id="disinfect-help" className="block text-xs text-[#4A4A5A] mt-0.5">Required. It goes on the box label with your name and the time.</span>
          {wide && draft.records.disinfected && draft.records.disinfectedBy && (
            <span className="block text-[11px] font-semibold text-[#166534] mt-1">On the label: {draft.records.disinfectedBy} · {draft.records.disinfectedAt}</span>
          )}
        </span>
      </label>
    </div>
  );
}

function UploadBox({ onChange }: { onChange: () => void }) {
  const { draft, update, readOnly } = useCase();
  const wide = useRoom() === 'wide';
  const input = useRef<HTMLInputElement>(null);
  const [over, setOver] = useState(false);
  const add = (names: string[]) => update(d => ({ ...d, records: { ...d.records, files: [...d.records.files, ...names.map(name => ({ name, role: guessFileRole(name) }))] } }));
  const setRole = (i: number, role: FileRole) => update(d => ({ ...d, records: { ...d.records, files: d.records.files.map((f, j) => (j === i ? { ...f, role } : f)) } }));
  const onDrop = (e: DragEvent) => { e.preventDefault(); setOver(false); add(Array.from(e.dataTransfer.files).map(f => f.name)); };
  return (
    <div className="space-y-4">
      <Settled src="You" action={!readOnly && <SecondaryButton onClick={onChange}>Change</SecondaryButton>}>Upload files</Settled>
      {!readOnly && (
        <div
          tabIndex={0}
          role="button"
          aria-label="Drop STL, PLY, OBJ or DCM files, or browse"
          onKeyDown={e => { if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); input.current?.click(); } }}
          onClick={() => input.current?.click()}
          onDragOver={e => { e.preventDefault(); setOver(true); }}
          onDragLeave={() => setOver(false)}
          onDrop={onDrop}
          className={`flex flex-col items-center justify-center gap-2 ${wide ? 'py-9' : 'py-8'} rounded-xl border-2 border-dashed cursor-pointer ${over ? 'border-[#3F6FE8] bg-[#F5F8FF]' : 'border-[#C9C9D6] bg-white'} ${FOCUS}`}
        >
          {wide ? (
            <span className="w-11 h-11 mb-1 rounded-2xl bg-gradient-to-br from-[#EEF4FF] to-[#F3EEFF] border border-[#DCE6FD] text-[#2F62D6] flex items-center justify-center" aria-hidden><Upload className="w-5 h-5" strokeWidth={1.75} /></span>
          ) : (
            <Upload className="w-6 h-6 text-[#4A4A5A]" aria-hidden />
          )}
          <p className="text-sm text-[#1F1F2E]">Drop STL, PLY, OBJ or DCM files, or <span className="font-semibold text-[#2F62D6]">Browse</span></p>
          {wide && <p className="text-[11px] text-[#5A5A6A]">Upper, lower and bite are named from the file names; you name the rest.</p>}
          <input ref={input} type="file" multiple accept=".stl,.ply,.obj,.dcm" className="hidden" onChange={e => { add(Array.from(e.target.files ?? []).map(f => f.name)); e.target.value = ''; }} />
        </div>
      )}
      {!readOnly && draft.records.files.length === 0 && (
        <LinkButton onClick={() => add(['Upper_jaw.stl', 'Lower_jaw.stl', 'Bite_scan.stl', 'scan_0423.ply'])}>Use demo files</LinkButton>
      )}
      {draft.records.files.map((f, i) => (
        <div key={i} className={`flex items-center gap-3 px-3 py-2.5 ${wide ? 'rounded-xl' : 'rounded-lg'} border border-[#E0E0E6] bg-white`}>
          {wide && f.role && f.role !== 'other'
            ? <ArchGlyph part={f.role} className="w-6 h-[18px] flex-shrink-0 text-[#2F62D6]" />
            : <FileUp className="w-4 h-4 text-[#4A4A5A]" aria-hidden />}
          <span className="text-sm text-[#030213] flex-1 truncate">{f.name}</span>
          {f.role && <span className="text-xs font-semibold text-[#1E3A8A] capitalize">{f.role}</span>}
          {!f.role && (
            <div className="flex items-center gap-2">
              <span className="text-xs text-[#8A4B08] font-semibold">Which is {f.name}?</span>
              <ChoiceChips label={`Which is ${f.name}?`} size="sm" value={undefined} onChange={r => setRole(i, r as FileRole)} options={['upper', 'lower', 'bite', 'other'].map(r => ({ id: r, label: r.charAt(0).toUpperCase() + r.slice(1) }))} />
            </div>
          )}
        </div>
      ))}
    </div>
  );
}

// ─── Prescriber ──────────────────────────────────────────────────────────────

export const PrescriberStep = forwardRef<HTMLHeadingElement>(function PrescriberStep(_, ref) {
  const { draft, update, user, prescriber, prescriberSrc, notes, dismissNote, readOnly, toast } = useCase();
  const wide = useRoom() === 'wide';
  const [changing, setChanging] = useState(false);
  const login = draft.login?.split(':');
  const unlinked = notes.find(n => n.kind === 'unlinked');
  const choose = (id: string) => { update(d => ({ ...d, prescriber: id as typeof d.prescriber, prescriberSrc: id === user.id ? 'You' : 'You picked' })); setChanging(false); };
  const ask = !prescriber || changing;
  return (
    <div className="space-y-5">
      <StepHeading ref={ref} kicker="Prescriber" title={ask ? 'Who is prescribing?' : 'Prescriber'} icon={Stethoscope}>
        {ask ? 'The prescription has to be in a dentist’s name.' : null}
      </StepHeading>
      {!ask && prescriber && (wide ? <PrescriberCard onChange={() => setChanging(true)} /> : (
        <Settled src={prescriberSrc} action={!readOnly && <SecondaryButton onClick={() => setChanging(true)}>Change</SecondaryButton>} sub={<>{CLINIC.name}, {CLINIC.city} <SourceTag src={draft.scan ? 'From scanner' : 'Your clinic'} /></>}>
          {prescriber.name}{prescriber.id === user.id ? ' (you)' : ''}{prescriber.gdc ? ` · GDC ${prescriber.gdc}` : ''}
        </Settled>
      ))}
      {ask && (
        <>
          {wide
            ? <DentistCards value={draft.prescriber} onPick={choose} />
            : <ChoiceChips label="Who is prescribing?" value={draft.prescriber} onChange={choose} options={DENTISTS.map(d => ({ id: d.id, label: userTitle(d) }))} />}
          {draft.login && (
            <label className="flex items-center gap-2.5 text-sm text-[#1F1F2E] cursor-pointer">
              <input type="checkbox" checked={draft.rememberLogin} onChange={e => update(d => ({ ...d, rememberLogin: e.target.checked }))} className="w-4 h-4 accent-[#3F6FE8]" />
              Remember for this {login?.[0]} login
            </label>
          )}
        </>
      )}
      {prescriber && !prescriber.gdc && (
        <Notice tone="block" actions={<SecondaryButton onClick={() => toast.info(`Asked ${CLINIC.practiceManager} to add the GDC number.`)}>Ask {CLINIC.practiceManager} to Add It</SecondaryButton>}>
          {prescriber.name} has no GDC number on file, so the prescription can’t be sent.
        </Notice>
      )}
      {unlinked && user.role === 'dentist' && draft.login && (
        <Notice tone="note" onDismiss={() => dismissNote(unlinked.id)} actions={<SecondaryButton onClick={() => { learnLogin(draft.login!, user.id); dismissNote(unlinked.id); toast.success(`${login?.[0]} login '${login?.[1]}' is now linked to you.`); }}>Link It to Me</SecondaryButton>}>
          {unlinked.text}
        </Notice>
      )}
    </div>
  );
});

const ROLE_WORD: Record<User['role'], string> = { dentist: 'Dentist', nurse: 'Dental nurse' };

/** The prescriber, and the line their Send signs. */
function PrescriberCard({ onChange }: { onChange: () => void }) {
  const { draft, ctx, user, prescriber, prescriberSrc, patient, readOnly } = useCase();
  if (!prescriber) return null;
  const mode = sendMode(user, prescriber);
  const signs = prescriber.gdc ? attestation(mode, user, prescriber, patient, recordsState(draft, ctx) === 'follow') : '';
  return (
    <div className="rounded-2xl border border-[#E0E0E6] bg-white p-5">
      <div className="flex items-start gap-4">
        <Avatar text={userInitials(prescriber)} />
        <div className="flex-1 min-w-0">
          <div className="flex items-center gap-2 flex-wrap">
            <p className="text-base font-semibold text-[#030213]">{prescriber.name}{prescriber.id === user.id ? ' (you)' : ''}</p>
            <SourceTag src={prescriberSrc} />
          </div>
          <p className="mt-0.5 text-xs text-[#4A4A5A]">{ROLE_WORD[prescriber.role]}{prescriber.gdc ? ` · GDC ${prescriber.gdc}` : ''}</p>
          <p className="mt-1 flex items-center gap-1.5 flex-wrap text-xs text-[#4A4A5A]">{CLINIC.name}, {CLINIC.city} <SourceTag src={draft.scan ? 'From scanner' : 'Your clinic'} /></p>
        </div>
        {!readOnly && <SecondaryButton onClick={onChange}>Change</SecondaryButton>}
      </div>
      {signs && (
        <div className="mt-4 rounded-xl border border-[#ECECF2] bg-[#F8F9FC] px-4 py-3.5">
          <p className="flex items-center gap-1.5 text-[10px] font-bold uppercase tracking-widest text-[#5A5A6A]">
            <PenLine className="w-3.5 h-3.5" strokeWidth={1.75} aria-hidden />{mode === 'approval' ? 'Approves and signs' : 'Signs the prescription'}
          </p>
          <p aria-hidden className="mt-2 inline-block min-w-[200px] pb-1 border-b border-dashed border-[#C8D8FC] font-serif italic text-lg text-[#1E3A8A]">{prescriber.name}</p>
          <p className="mt-2 text-xs text-[#4A4A5A] leading-relaxed">{signs}</p>
        </div>
      )}
    </div>
  );
}

/** The practice's dentists as small cards (a radiogroup), each saying how Send works with them. */
function DentistCards({ value, onPick }: { value?: string; onPick: (id: string) => void }) {
  const { user } = useCase();
  const stop = DENTISTS.some(d => d.id === value) ? value : DENTISTS[0]?.id;
  return (
    <div role="radiogroup" aria-label="Who is prescribing?" onKeyDown={roveRadios} className="grid grid-cols-2 gap-3">
      {DENTISTS.map(d => {
        const selected = value === d.id;
        return (
          <button
            key={d.id}
            type="button"
            role="radio"
            aria-checked={selected}
            aria-label={userTitle(d)}
            aria-describedby={`nc-rx-${d.id}`}
            tabIndex={d.id === stop ? 0 : -1}
            onClick={() => onPick(d.id)}
            className={`flex items-center gap-3 px-3.5 py-2 rounded-xl border text-left transition-colors motion-reduce:transition-none ${FOCUS} ${selected ? 'bg-[#EEF4FF] border-[#3F6FE8] ring-1 ring-[#3F6FE8]' : 'bg-white border-[#D4D4DD] hover:border-[#3F6FE8] hover:bg-[#F8FAFF]'}`}
          >
            <Avatar text={userInitials(d)} size="sm" />
            <span className="flex-1 min-w-0">
              <span className="flex items-center gap-1.5 min-w-0">
                <span className="text-sm font-semibold text-[#030213] truncate">{d.name}</span>
                {d.id === user.id && <SourceTag src="You" />}
              </span>
              <span id={`nc-rx-${d.id}`} className="block text-[11px] text-[#5A5A6A] truncate">{d.gdc ? `GDC ${d.gdc} · ` : ''}{sendsHow(user, d)}</span>
            </span>
            {selected && <Check className="w-4 h-4 text-[#2F62D6] flex-shrink-0" strokeWidth={3} aria-hidden />}
          </button>
        );
      })}
    </div>
  );
}

// ─── Delivery ────────────────────────────────────────────────────────────────

export function backByText(api: ReturnType<typeof useCase>): string {
  const { dates, lab } = api;
  if (dates.route === 'follow' && dates.ta != null && dates.backBy) {
    return `Back ${plural(dates.ta, 'working day')} after the scan arrives (${fmtDay(dates.backBy)} if it arrives before ${fmtCutoff(lab.cutoffMin)} today)`;
  }
  if (!dates.backBy) return 'Back-by date once every item can be made';
  return `Back by ${fmtDay(dates.backBy)} · ${plural(dates.ta!, 'working day')}`;
}

export const DeliveryStep = forwardRef<HTMLHeadingElement>(function DeliveryStep(_, ref) {
  const api = useCase();
  const { draft, update, dates, lab, go, openDrawer, ctx, notes, dismissNote, sendSeparately, readOnly } = api;
  const wide = useRoom() === 'wide';
  const eligible = draft.items.filter(i => fastTrackEligible(i, ctx));
  const fit = draft.fit && dates.backBy ? fitCheck(draft.fit, dates.backBy) : null;
  const split = splitSuggestion(draft, ctx, dates);
  const deliveryNotes = notes.filter(n => n.step === 'delivery');
  return (
    <div className="space-y-5">
      <StepHeading ref={ref} kicker="Delivery" title="When will it be back?" icon={CalendarDays} />
      {wide ? <DateJourney /> : (
        <>
          <Settled src={draft.labSrc} action={!readOnly && <SecondaryButton onClick={() => go('lab')}>Change</SecondaryButton>} sub={`${lab.city} · cut-off ${fmtCutoff(lab.cutoffMin)} · ${dates.route === 'post' ? `posted, received ${dates.received ? fmtDay(dates.received) : ''}` : dates.route === 'follow' ? 'received when the scan arrives' : `received ${dates.received ? fmtDay(dates.received) : ''}`}`}>
            {lab.name}
          </Settled>
          <Settled src="Calculated">{backByText(api)}</Settled>
        </>
      )}

      {eligible.length > 0 && lab.fastTrack && !readOnly && (wide ? (
        <label className="flex items-center gap-3 px-4 py-3 rounded-xl border border-[#E0E0E6] bg-white cursor-pointer hover:bg-[#F8FAFF] focus-within:ring-2 focus-within:ring-[#3F6FE8]">
          <input type="checkbox" checked={draft.fastTrack} onChange={e => update(d => ({ ...d, fastTrack: e.target.checked }))} className="w-4 h-4 accent-[#3F6FE8]" />
          <span className="w-8 h-8 rounded-lg bg-[#FFF8E1] border border-[#F5D98B] text-[#B45309] flex items-center justify-center flex-shrink-0" aria-hidden><Zap className="w-4 h-4" strokeWidth={1.75} /></span>
          <span className="min-w-0">
            <span className="block text-sm font-semibold text-[#030213]">Fast-Track</span>
            <span className="sr-only"> · </span>
            <span className="block text-xs text-[#4A4A5A]">{lab.fastTrack.daysFaster} working days faster</span>
          </span>
        </label>
      ) : (
        <label className="flex items-center gap-3 px-4 py-3 rounded-xl border border-[#E0E0E6] bg-white cursor-pointer">
          <input type="checkbox" checked={draft.fastTrack} onChange={e => update(d => ({ ...d, fastTrack: e.target.checked }))} className="w-4 h-4 accent-[#3F6FE8]" />
          <Zap className="w-4 h-4 text-[#B45309]" aria-hidden />
          <span className="text-sm text-[#1F1F2E]">Fast-Track · {lab.fastTrack.daysFaster} working days faster</span>
        </label>
      ))}

      {dates.route !== 'follow' && dates.backBy && (
        fit ? (
          <Settled src="You" action={!readOnly && <div className="flex gap-2"><SecondaryButton onClick={() => openDrawer({ kind: 'fit' })}>Change</SecondaryButton><SecondaryButton onClick={() => update(d => ({ ...d, fit: undefined }))}>Remove</SecondaryButton></div>}>
            {fitLine(fit)}
          </Settled>
        ) : wide ? (
          <div className="flex items-center gap-3 px-4 py-3 rounded-xl border border-dashed border-[#C9C9D6] bg-white">
            <span className="w-8 h-8 rounded-lg bg-[#EEF4FF] text-[#2F62D6] flex items-center justify-center flex-shrink-0" aria-hidden><CalendarCheck className="w-4 h-4" strokeWidth={1.75} /></span>
            <p className="flex-1 min-w-0 text-sm text-[#1F1F2E]">
              <span className="block font-semibold text-[#030213]">Fit appointment</span>
              <span className="block text-xs text-[#4A4A5A]">Book the fit from <span className="font-semibold text-[#030213]">{dates.earliestFit ? fmtDay(dates.earliestFit) : '—'}</span></span>
            </p>
            {!readOnly && <PrimaryButton onClick={() => openDrawer({ kind: 'fit' })}>Add Fit Appointment</PrimaryButton>}
          </div>
        ) : (
          <div className="flex items-center gap-3 px-4 py-3.5 rounded-xl border border-dashed border-[#C9C9D6] bg-white">
            <CalendarDays className="w-5 h-5 text-[#4A4A5A]" aria-hidden />
            <p className="text-sm text-[#1F1F2E] flex-1">Book the fit from <span className="font-semibold">{dates.earliestFit ? fmtDay(dates.earliestFit) : '—'}</span></p>
            {!readOnly && <PrimaryButton onClick={() => openDrawer({ kind: 'fit' })}>Add Fit Appointment</PrimaryButton>}
          </div>
        )
      )}

      {split && !draft.keepTogether && !draft.split && !readOnly && (
        <Notice tone="note" actions={<><SecondaryButton onClick={() => sendSeparately(true)}>Send Separately</SecondaryButton><SecondaryButton onClick={() => update(d => ({ ...d, keepTogether: true }))}>Keep Together</SecondaryButton></>}>
          The {PRODUCTS[split.item.product].noun} alone would be back {fmtDay(split.backBy)}.
        </Notice>
      )}
      {draft.split && (
        <Notice tone="success" actions={!readOnly && <SecondaryButton onClick={() => sendSeparately(false)}>Keep Together</SecondaryButton>}>
          Sends as 2 cases: the {shortPhrase(draft.items.find(i => i.id === split?.item.id) ?? draft.items[0], api.user.notation)} goes on its own and is back {split ? fmtDay(split.backBy) : 'sooner'}.
        </Notice>
      )}
      {deliveryNotes.map(n => <NoteView key={n.id} note={n} onDismiss={() => dismissNote(n.id)} />)}
      <p className="text-xs text-[#5A5A6A] flex items-center gap-1.5"><Truck className="w-3.5 h-3.5" aria-hidden />Turnaround includes delivery back to {CLINIC.name}. Working days are Mon–Fri, excluding bank holidays.</p>
    </div>
  );
});

/** Today → the lab receives it → back by, with the back-by day as a calendar page. Only dates the rules work out. */
function DateJourney() {
  const { dates, lab, draft, ctx, go, readOnly } = useCase();
  const cut = fmtCutoff(lab.cutoffMin);
  const follow = dates.route === 'follow';
  const { received, backBy, ta } = dates;
  const receivedSub = dates.route === 'post'
    ? `Posted · ${plural(CLINIC.courierDays, 'courier working day')}`
    : received && sameDay(received, ctx.now) ? `Before the ${cut} cut-off` : 'Next working day';
  const stops: { label: string; value: string; sub?: string }[] = [
    { label: 'Today', value: fmtDay(ctx.now), sub: follow ? 'The prescription goes now' : undefined },
    follow
      ? { label: 'Scan arrives', value: 'When it’s taken', sub: `Lab cut-off ${cut}` }
      : { label: 'Lab receives', value: received ? fmtDay(received) : '—', sub: receivedSub },
    backBy && ta != null
      ? follow
        ? { label: 'Back', value: `${plural(ta, 'working day')} after`, sub: `${fmtDay(backBy)} if it arrives before ${cut} today` }
        : { label: 'Back by', value: fmtDay(backBy), sub: 'Delivered to the practice' }
      : { label: 'Back by', value: 'Not yet', sub: 'Once every item can be made' },
  ];
  return (
    <div className="rounded-2xl border border-[#E0E0E6] bg-white">
      <div className="flex items-center gap-3 px-5 py-3 border-b border-[#F0EFF6]">
        <span className={`w-7 h-7 rounded-lg flex items-center justify-center text-[10px] font-bold flex-shrink-0 ${lab.avatar}`} aria-hidden>{lab.initials}</span>
        <p className="flex-1 min-w-0 truncate text-sm font-semibold text-[#030213]">{lab.name}<span className="font-normal text-[#4A4A5A]"> · {lab.city} · cut-off {cut}</span></p>
        <SourceTag src={draft.labSrc} />
        {!readOnly && <LinkButton onClick={() => go('lab')}>Change Lab</LinkButton>}
      </div>
      <div className="flex items-center gap-6 px-5 py-5">
        {/* Scan to follow: the back-by day only holds if the scan beats the cut-off, so no calendar page. */}
        {backBy && ta != null && !follow && <CalendarPage date={backBy} caption={`${plural(ta, 'working day')}${draft.fastTrack ? ' · Fast-Track' : ''}`} />}
        <ol aria-label="Dates" className="flex-1 min-w-0 grid grid-cols-3">
          {stops.map((s, i) => (
            <li key={s.label} className="min-w-0 pr-3">
              <span className="flex items-center" aria-hidden>
                <span className={`w-3 h-3 rounded-full border-2 flex-shrink-0 ${i === stops.length - 1 ? 'border-[#2F62D6] bg-[#2F62D6]' : 'border-[#3F6FE8] bg-white'}`} />
                {i < stops.length - 1 && <span className="flex-1 h-0.5 ml-1 -mr-3 rounded-full bg-[#DCE6FD]" />}
              </span>
              <p className="mt-2.5 text-[10px] font-bold uppercase tracking-widest text-[#5A5A6A]">{s.label}</p>
              <p className="mt-0.5 text-sm font-semibold text-[#030213]">{s.value}</p>
              {s.sub && <p className="mt-0.5 text-[11px] text-[#4A4A5A]">{s.sub}</p>}
            </li>
          ))}
        </ol>
      </div>
    </div>
  );
}

/** A small tear-off calendar page: month band, day, weekday, and a caption under it. */
function CalendarPage({ date, caption }: { date: Date; caption: string }) {
  const [weekday, day, month] = fmtDay(date).split(' ');
  return (
    <div aria-hidden className="w-[88px] flex-shrink-0 text-center">
      <div className="rounded-xl border border-[#DCE6FD] bg-white overflow-hidden shadow-[0_6px_14px_-8px_rgba(47,98,214,0.45)]">
        <p className={`${GRADIENT_BTN} py-1 text-[10px] font-bold uppercase tracking-widest`}>{month}</p>
        <p className="pt-1.5 text-2xl font-semibold leading-none text-[#030213]">{day}</p>
        <p className="pb-1.5 pt-1 text-[11px] text-[#4A4A5A]">{weekday}</p>
      </div>
      <p className="mt-1.5 text-[11px] font-semibold text-[#3A3A4A] leading-tight">{caption}</p>
    </div>
  );
}

// ─── Small pieces ────────────────────────────────────────────────────────────

/** Sets a forwarded ref, object or callback. */
function assignRef<T>(ref: ForwardedRef<T>, value: T | null) {
  if (typeof ref === 'function') ref(value);
  else if (ref) ref.current = value;
}

const ROVE_STEP: Record<string, number> = { ArrowRight: 1, ArrowDown: 1, ArrowLeft: -1, ArrowUp: -1 };
/** Arrow keys (and Home/End) walk a radiogroup's radios; Enter or Space picks. */
function roveRadios(e: KeyboardEvent<HTMLElement>) {
  const step = ROVE_STEP[e.key];
  if (step === undefined && e.key !== 'Home' && e.key !== 'End') return;
  const radios = Array.from(e.currentTarget.querySelectorAll<HTMLElement>('[role="radio"]:not(:disabled):not([aria-disabled="true"])'));
  const i = radios.indexOf(document.activeElement as HTMLElement);
  if (i < 0) return;
  e.preventDefault();
  const n = radios.length;
  radios[e.key === 'Home' ? 0 : e.key === 'End' ? n - 1 : (i + step + n) % n].focus();
}

/** Segmented (radios), each option with its icon. */
function IconSegmented<T extends string>({ label, value, options, onChange, disabled }: {
  label: string; value: T; options: { id: T; label: string; icon: LucideIcon }[]; onChange: (v: T) => void; disabled?: boolean;
}) {
  return (
    <div role="radiogroup" aria-label={label} onKeyDown={roveRadios} className="inline-flex gap-1 p-1 rounded-xl bg-[#F0EFF6] border border-[#E0E0E6]">
      {options.map(({ id, label: text, icon: Icon }) => (
        <button
          key={id}
          type="button"
          role="radio"
          aria-checked={value === id}
          tabIndex={value === id ? 0 : -1}
          disabled={disabled}
          onClick={() => onChange(id)}
          className={`inline-flex items-center gap-1.5 h-8 px-3.5 rounded-lg text-sm font-semibold transition-colors motion-reduce:transition-none ${FOCUS} ${value === id ? 'bg-white text-[#1E40AF] shadow-sm ring-1 ring-[#DCE6FD]' : 'text-[#4A4A5A] hover:text-[#030213] hover:bg-white/70'}`}
        >
          <Icon className={`w-3.5 h-3.5 ${value === id ? 'text-[#2F62D6]' : ''}`} strokeWidth={1.75} aria-hidden />
          {text}
        </button>
      ))}
    </div>
  );
}

function Avatar({ text, size = 'md' }: { text: string; size?: 'sm' | 'md' }) {
  return (
    <span aria-hidden className={`${size === 'md' ? 'w-12 h-12 text-base' : 'w-8 h-8 text-xs'} rounded-full bg-gradient-to-br from-[#EEF4FF] to-[#F3EEFF] border border-[#DCE6FD] text-[#2F62D6] font-semibold flex items-center justify-center flex-shrink-0`}>
      {text}
    </span>
  );
}

/** "· [icon] Cut-off 3pm" on the lab strip. */
function Fact({ icon: Icon, children }: { icon?: LucideIcon; children: ReactNode }) {
  return (
    <>
      <span aria-hidden className="flex-shrink-0 text-[#B8B8C6]">·</span>
      <span className="inline-flex items-center gap-1 flex-shrink-0">
        {Icon && <Icon className="w-3.5 h-3.5 text-[#5A5A6A]" strokeWidth={1.75} aria-hidden />}
        {children}
      </span>
    </>
  );
}

/** Tiny occlusal arch pictograms: upper (∩), lower (∪), bite (both meeting). Dashes read as teeth. */
function ArchGlyph({ part, className = '' }: { part: 'upper' | 'lower' | 'bite'; className?: string }) {
  const stroke = { fill: 'none', stroke: 'currentColor', strokeLinecap: 'round' as const, strokeDasharray: '3.2 1.6' };
  return (
    <svg viewBox="0 0 32 24" className={className} aria-hidden>
      {part === 'upper' && <path d="M6 21C6 10 10 4 16 4s10 6 10 17" strokeWidth={3.5} {...stroke} />}
      {part === 'lower' && <path d="M6 3c0 11 4 17 10 17s10-6 10-17" strokeWidth={3.5} {...stroke} />}
      {part === 'bite' && (
        <>
          <path d="M7 10.5C7 5.5 11 3 16 3s9 2.5 9 7.5" strokeWidth={3} {...stroke} />
          <path d="M7 13.5c0 5 4 7.5 9 7.5s9-2.5 9-7.5" strokeWidth={3} {...stroke} />
        </>
      )}
    </svg>
  );
}

const BOX_ICON: Record<string, LucideIcon> = { 'Shade tab': Palette, 'Old denture': Smile, 'Implant components': Anchor, 'Recorded bite blocks': Layers };
const BOX_ARCH: Record<string, 'upper' | 'lower' | 'bite'> = { 'Upper impression': 'upper', 'Lower impression': 'lower', 'Bite registration': 'bite' };
function BoxGlyph({ item, on }: { item: string; on: boolean }) {
  const tone = on ? 'text-[#2F62D6]' : 'text-[#8B8B9E]';
  if (BOX_ARCH[item]) return <ArchGlyph part={BOX_ARCH[item]} className={`w-5 h-4 flex-shrink-0 ${tone}`} />;
  const Icon = BOX_ICON[item] ?? Box;
  return <Icon className={`w-4 h-4 flex-shrink-0 ${tone}`} strokeWidth={1.75} aria-hidden />;
}

const cap = (s: string) => s.charAt(0).toUpperCase() + s.slice(1);
/** itemPhrase, but past four teeth a count ("crown (30 teeth)"), never a paragraph of tooth numbers. */
const shortPhrase = (i: ServiceItem, n: User['notation']) =>
  i.teeth.length > 4 && !PRODUCTS[i.product].archItem ? `${PRODUCTS[i.product].noun} (${i.teeth.length} teeth)` : itemPhrase(i, n);
/** "Dr Sarah Khan" → "SK" */
const userInitials = (u: User) => u.name.replace(/^Dr\.?\s+/, '').split(/\s+/).map(w => w[0]).join('').slice(0, 2).toUpperCase();
/** How Send works with this prescriber, for the user who's sending. */
function sendsHow(user: User, d: User): string {
  const mode = sendMode(user, d);
  if (mode === 'self') return 'You sign it';
  if (mode === 'delegated') return `You send it in ${d.short}’s name`;
  return `${d.short} approves it first`;
}
