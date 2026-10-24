// ─── New Case Flow · describe with AI ────────────────────────────────────────
// The Start from Scratch page's default tab, after the portal's "✨ AI ·
// Describe the case": a big editor pre-filled with the template (Patient
// Name: / Lab Name: / Service 1: / Teeth/Arch: / Material/Shade: / Delivery:
// / Instruction:) that also takes plain sentences, four examples, and an
// "Add Prescription / Order Form" drop zone (the reading is mocked, as on the
// portal). Beside it, "What Smile Genius understood" re-reads the text as you
// type (250 ms after the last key) and shows, field by field, what it matched:
// the patient (or a new one, with the date of birth it needs, inline), the
// lab, each service against that lab's real options, delivery and the
// instruction, plus anything it couldn't place. A full denture shows its stage
// plan instead of one delivery date. No prices; no popups.
// "Create Case" builds the draft (describe.ts), saves it as a Draft row and
// opens it at whatever is still missing. A patient's waiting scan draft is
// filled instead of starting a second draft, unless the user says otherwise.

import { createContext, forwardRef, useCallback, useContext, useEffect, useId, useImperativeHandle, useMemo, useRef, useState, DragEvent, KeyboardEvent, ReactNode } from 'react';
import { useNavigate } from 'react-router-dom';
import {
  AlertTriangle, CalendarDays, Check, ChevronRight, CircleHelp, CornerDownLeft, FileText, FlaskConical, Loader2, MessageSquareText, Mic, Plus, ScanLine, Sparkles, Square,
  Stethoscope, Undo2, UploadCloud, UserPlus, UserRound, X, Zap,
} from 'lucide-react';
import { CLINIC, Lab, Patient, User, userById } from './data';
import { demoNow, fmtDay, fmtFull, fmtShort, fromISO, maskDOB, parseDOB } from './dates';
import {
  Ctx, DENTURE_STAGES, DentureStageId, PRODUCTS, ServiceItem, StagePlan, archCaps, caseDates, dentureTreatment, effective, fullName, isPosted, labsThatMake,
  optionAvail, optionName, patientAge, plural, recordsState, shadeSwatch, slotsFor, stageName, stageOption, stagePlan, suggestedStageDates,
  toothText, treatmentName,
} from './rules';
import { useDictation } from './dictation';
import { CaseRow, addPatient, allPatients, nextCaseId, openDraftsFor, saveRow, useFlowStore } from './store';
import { buildCtx, serviceSummary } from './derive';
import { PRODUCT_ICON } from './ServiceSteps';
import { FOCUS, GRADIENT_BTN, LinkButton, StateIcon } from './ui';
import {
  EXAMPLES, OCR_TEXT, Parsed, Preview, SLOT_LABEL, ServiceRead, TEMPLATE, announceText, buildDraft, fieldCaret, insertServiceBlock,
  newPatientReady, nextFieldCaret, nextServiceNumber, optSlotOf, parseDescription, previewCase, takesShade, understood, withPatientName,
} from './describe';

export interface AiUnderstood {
  patient?: string;
  patientReady: boolean;
  lab?: string;
  labReady: boolean;
  services?: string;
  servicesReady: boolean;
}
export interface AiStartHandle {
  /** Focus the editor at a field's line (the end of the text when there's no such line). */
  focusField: (field?: 'patient' | 'lab' | 'service') => void;
}

/** Keyframes used only here; every use goes through motion-safe:. */
const KEYFRAMES = `
@keyframes ai-shimmer { from { background-position: 200% 0; } to { background-position: -200% 0; } }
@keyframes ai-in { from { opacity: 0; transform: translateY(3px); } to { opacity: 1; transform: none; } }
@keyframes ai-drift { 0%, 100% { transform: translate3d(0, 0, 0) scale(1); } 50% { transform: translate3d(-1.5%, 1.5%, 0) scale(1.05); } }
@keyframes ai-dot { 0%, 80%, 100% { opacity: 0.25; } 40% { opacity: 1; } }
@keyframes ai-panel-in { from { opacity: 0; transform: translateX(16px); } to { opacity: 1; transform: none; } }
`;
const AURORA = [
  'radial-gradient(560px 380px at 8% 0%, rgb(199 215 255 / 0.55), transparent 70%)',
  'radial-gradient(520px 420px at 62% 100%, rgb(228 218 255 / 0.55), transparent 70%)',
  'radial-gradient(420px 320px at 100% 18%, rgb(207 243 239 / 0.5), transparent 70%)',
].join(', ');
/** The small buttons in the editor's bottom bar (Next Line, the finishing action). */
const MINI_BTN = 'inline-flex items-center gap-1 h-6 px-2 rounded-md border text-[11px] font-semibold whitespace-nowrap shadow-[0_1px_0_rgba(3,2,19,0.05)] transition-colors motion-reduce:transition-none disabled:opacity-40 disabled:cursor-not-allowed focus:outline-none focus-visible:ring-2 focus-visible:ring-[#3F6FE8] focus-visible:ring-offset-2';
/** What the demo dictation "says" where the browser has no speech recognition. */
const DEMO_DICTATION = 'Emax crown on 26, shade A2, for Amelia Clarke at Northfield Dental Lab, needed by 12 Nov';
const CARD = 'bg-white/90 backdrop-blur-sm border border-[#E0E0E6] rounded-2xl shadow-[0_1px_2px_rgba(3,2,19,0.04),0_18px_40px_-28px_rgba(63,111,232,0.4)]';
const IN = 'motion-safe:animate-[ai-in_0.3s_ease-out_both]';
const SHIMMER = 'bg-[length:200%_100%] motion-safe:animate-[ai-shimmer_1.3s_linear_infinite]';
const CREATE_STEPS = ['Reading your description', 'Matching the patient', 'Building the services', 'Done'];

const fmtSize = (n: number) => (n >= 1024 * 1024 ? `${(n / (1024 * 1024)).toFixed(1)} MB` : `${Math.max(1, Math.round(n / 1024))} KB`);
const isMac = () => typeof navigator !== 'undefined' && /Mac|iPhone|iPad/.test(navigator.platform);

/** The patient's open draft to fill: a waiting scan first, else the latest. */
function openDraftOf(patientId: string): CaseRow | undefined {
  return [...openDraftsFor(patientId)].sort((a, b) => Number(b.source === 'scanner') - Number(a.source === 'scanner') || b.updatedAt - a.updatedAt)[0];
}

/** `initialText`: carrying on from a case (its description written back as the template). */
const AiStart = forwardRef<AiStartHandle, { onUnderstood?: (u: AiUnderstood) => void; initialText?: string }>(function AiStart({ onUnderstood, initialText }, ref) {
  const navigate = useNavigate();
  const store = useFlowStore();
  const user = userById(store.userId)!;
  const uid = useId();
  const taRef = useRef<HTMLTextAreaElement>(null);
  const fileRef = useRef<HTMLInputElement>(null);
  const timers = useRef<number[]>([]);
  useEffect(() => () => timers.current.forEach(t => window.clearTimeout(t)), []);

  const [text, setText] = useState(initialText ?? TEMPLATE);
  const textRef = useRef(text);
  textRef.current = text;
  const readCtx = useCallback(
    () => ({ patients: allPatients(), user, now: demoNow(), favourites: store.favourites }),
    [user, store.favourites, store.patients], // eslint-disable-line react-hooks/exhaustive-deps
  );
  const [parsed, setParsed] = useState<Parsed>(() => parseDescription(initialText ?? TEMPLATE, readCtx()));
  const [reading, setReading] = useState(false);
  // Nothing runs as you type: the description is read only when asked (Read Description, or Ctrl+Enter).
  // `readText` is what the panel shows; once the text differs, the panel says so.
  const [readText, setReadText] = useState(initialText ?? TEMPLATE);
  // The panel appears once something has been read (straight away when carrying on from a case).
  const [hasRead, setHasRead] = useState(!!initialText);
  const stale = text !== readText;
  const readTimer = useRef<number>();
  useEffect(() => () => window.clearTimeout(readTimer.current), []);
  const read = () => {
    if (reading) return;
    setReading(true);
    readTimer.current = window.setTimeout(() => {
      const t = textRef.current;
      setParsed(parseDescription(t, readCtx()));
      setReadText(t);
      setHasRead(true);
      setReading(false);
    }, 450);
  };

  // ── New patient's date of birth (the description may carry it) ──
  const [dob, setDob] = useState('');
  const [dobTyped, setDobTyped] = useState(false);
  const [attempted, setAttempted] = useState(false);
  const heardDob = parsed.patient.kind === 'new' ? parsed.patient.dob : undefined;
  // A date of birth the text carries follows the text (and goes when it does); a typed one stays with its patient.
  useEffect(() => { if (!dobTyped) setDob(heardDob ?? ''); }, [heardDob, dobTyped]);
  const newFirst = parsed.patient.kind === 'new' ? parsed.patient.first.toLowerCase() : '';
  const dobFor = useRef('');
  useEffect(() => {
    if (!newFirst) return;
    const was = dobFor.current;
    dobFor.current = newFirst;
    // Someone else now (not "Sara" → "Sarah"): their date of birth starts empty.
    if (was && !was.startsWith(newFirst) && !newFirst.startsWith(was)) { setDobTyped(false); setDob(''); }
  }, [newFirst]);

  // ── A known patient's open draft (a waiting scan) is filled, not doubled ──
  const matched = parsed.patient.kind === 'matched' ? parsed.patient.patient : undefined;
  const openDraft = useMemo(() => (matched ? openDraftOf(matched.id) : undefined), [matched, store.rows]); // eslint-disable-line react-hooks/exhaustive-deps
  const [separate, setSeparate] = useState(false);
  useEffect(() => { setSeparate(false); }, [matched?.id]);
  const base = openDraft && !separate ? openDraft.draft : undefined;

  const preview = useMemo(() => previewCase(parsed, user, demoNow(), { base, dob }), [parsed, user, base, dob]);

  const dobCheck = parseDOB(dob, demoNow());
  const p0 = parsed.patient;
  const blocker = stale ? 'The description changed. Press Read Description to update.'
    : p0.kind === 'none' ? 'Write the patient’s name to create the case.'
    : p0.kind === 'several' ? `Pick which ${p0.heard} this is.`
    : p0.kind === 'new' && !p0.last ? `Add ${p0.first}’s surname to create the case.`
    : p0.kind === 'new' && dobCheck.error ? `Add ${p0.first} ${p0.last}’s date of birth to create the case.`
    : null;

  // ── Announcements and the step timeline ──
  const [announce, setAnnounce] = useState('');

  // ── Dictation: each spoken phrase lands at the caret (the line being filled). ──
  const blankTemplate = () => textRef.current.split('\n').every(l => /^\s*$/.test(l) || /^[A-Za-z0-9 /]+:\s*$/.test(l));
  const spoken = (t: string) => {
    // The demo dictation speaks a whole case: it replaces a still-empty template.
    if (!dictation.live && blankTemplate()) { setText(t); setUndo(null); return; }
    const ta = taRef.current;
    const v = textRef.current;
    const at = ta ? ta.selectionStart : v.length;
    const before = v.slice(0, at);
    const sep = before && !/\s$/.test(before) ? ' ' : '';
    const next = before + sep + t + v.slice(at);
    setText(next);
    setUndo(null);
    window.requestAnimationFrame(() => { const c = (before + sep + t).length; ta?.focus(); ta?.setSelectionRange(c, c); });
  };
  const dictation = useDictation(spoken, DEMO_DICTATION);
  const said = useRef('');
  useEffect(() => {
    const s = announceText(parsed);
    if (s && s !== said.current) { said.current = s; setAnnounce(s); }
  }, [parsed]);
  useEffect(() => {
    if (!onUnderstood) return;
    const u = understood(parsed, user.notation);
    onUnderstood({
      patient: u.patient && (u.patientNew ? `${u.patient} · new` : u.patient),
      patientReady: parsed.patient.kind === 'matched' || newPatientReady(parsed, dob, demoNow()),
      lab: u.lab,
      // A named lab, or the lab the case goes to when none is named (the clinic's usual): the panel shows it, so the timeline does too.
      labReady: parsed.lab.kind !== 'unknown',
      services: u.services,
      servicesReady: !!u.services,
    });
  }, [parsed, dob, user.notation, onUnderstood]);

  // ── Editor ──
  const focusAt = (pos: number) => requestAnimationFrame(() => {
    const ta = taRef.current;
    if (!ta) return;
    ta.focus();
    ta.setSelectionRange(pos, pos);
  });
  useImperativeHandle(ref, () => ({
    focusField: field => {
      if (!field) { taRef.current?.focus(); return; }
      const at = fieldCaret(textRef.current, field);
      focusAt(at >= 0 ? at : textRef.current.length);
    },
  }), []);
  useEffect(() => {
    // A fresh template: the caret on the patient's line; carrying on from a case: at the end.
    const at = initialText ? initialText.length : fieldCaret(TEMPLATE, 'patient');
    taRef.current?.focus({ preventScroll: true });
    taRef.current?.setSelectionRange(at, at);
  }, []);

  const [undo, setUndo] = useState<{ text: string; what: string } | null>(null);
  const fill = (next: string, what: string) => {
    setUndo({ text: textRef.current, what });
    setText(next);
    focusAt(next.length);
  };
  const serviceN = Math.max(nextServiceNumber(text), parsed.services.length + 1);
  const addService = () => {
    const r = insertServiceBlock(textRef.current, serviceN);
    setUndo(null);
    setText(r.text);
    focusAt(r.caret);
  };
  const onKey = (e: KeyboardEvent<HTMLTextAreaElement>) => {
    if (e.key === 'Enter' && (e.ctrlKey || e.metaKey)) { e.preventDefault(); read(); return; }
    if (e.key !== 'Enter' || e.shiftKey || e.altKey || e.nativeEvent.isComposing) return;
    const ta = e.currentTarget;
    if (ta.selectionStart !== ta.selectionEnd) return;
    const to = nextFieldCaret(ta.value, ta.selectionStart);
    if (to == null) return;
    e.preventDefault();
    ta.setSelectionRange(to, to);
  };
  /** Next Line: the end of the next line that has something on it (the next template field). */
  const jumpNext = () => {
    const ta = taRef.current;
    if (!ta) return;
    const v = ta.value;
    let i = v.indexOf('\n', ta.selectionStart);
    while (i >= 0 && i < v.length) {
      let e = v.indexOf('\n', i + 1);
      if (e < 0) e = v.length;
      if (v.slice(i + 1, e).trim()) { focusAt(e); return; }
      i = e;
    }
    focusAt(v.length);
  };
  /** "Did you mean" / "Which one?": writes the full name (and, between namesakes, the date of birth) into the description. */
  const pickPatient = (p: Patient, heard: string) => {
    const namesakes = allPatients().filter(x => fullName(x).toLowerCase() === fullName(p).toLowerCase()).length > 1;
    const next = withPatientName(textRef.current, heard, namesakes ? `${fullName(p)}, ${p.dob}` : fullName(p));
    setUndo(null);
    setText(next);
  };

  // ── Prescription upload (the reading is mocked, as on the portal) ──
  const [file, setFile] = useState<{ name: string; size: string; state: 'reading' | 'read' } | null>(null);
  const [fileError, setFileError] = useState<string | null>(null);
  const [drag, setDrag] = useState(false);
  const onFile = (f?: File | null) => {
    if (!f) return;
    if (!/\.(pdf|jpe?g|png|heic|webp)$/i.test(f.name) && !/^(image\/|application\/pdf)/.test(f.type)) {
      setFileError('Add a PDF or a photo of the prescription.');
      return;
    }
    if (f.size > 10 * 1024 * 1024) { setFileError('That file is over 10 MB.'); return; }
    setFileError(null);
    setFile({ name: f.name, size: fmtSize(f.size), state: 'reading' });
    setAnnounce(`Reading ${f.name}`);
    timers.current.push(window.setTimeout(() => {
      setUndo({ text: textRef.current, what: 'prescription' });
      setText(OCR_TEXT);
      setFile(x => x && { ...x, state: 'read' });
      setAnnounce(`Read ${f.name}. The description is filled in for you to check.`);
    }, 800));
  };
  const hasFiles = (e: DragEvent) => Array.from(e.dataTransfer?.types ?? []).includes('Files');
  // A file let go anywhere else on the page must not open in the browser (and lose the description).
  useEffect(() => {
    const stop = (e: globalThis.DragEvent) => {
      if (e.defaultPrevented || !Array.from(e.dataTransfer?.types ?? []).includes('Files')) return;
      e.preventDefault();
      if (e.type === 'dragover' && e.dataTransfer) e.dataTransfer.dropEffect = 'none';
    };
    window.addEventListener('dragover', stop);
    window.addEventListener('drop', stop);
    return () => {
      window.removeEventListener('dragover', stop);
      window.removeEventListener('drop', stop);
    };
  }, []);
  const dropProps = {
    onDragEnter: (e: DragEvent) => { if (hasFiles(e)) { e.preventDefault(); setDrag(true); } },
    onDragOver: (e: DragEvent) => { if (hasFiles(e)) { e.preventDefault(); e.dataTransfer.dropEffect = 'copy'; } },
    onDragLeave: (e: DragEvent) => { if (!e.currentTarget.contains(e.relatedTarget as Node | null)) setDrag(false); },
    onDrop: (e: DragEvent) => { if (!hasFiles(e)) return; e.preventDefault(); setDrag(false); onFile(e.dataTransfer.files?.[0]); },
  };

  // ── Create ──
  const [progress, setProgress] = useState<number | null>(null);
  const save = (p: Parsed, to?: OpenTarget) => {
    let patient: Patient;
    if (p.patient.kind === 'matched') patient = p.patient.patient;
    else if (p.patient.kind === 'new') {
      patient = addPatient({
        first: p.patient.first, last: p.patient.last, dob: maskDOB(dob), sex: 'X',
        funding: p.funding ?? CLINIC.defaultFunding, lastLabel: 'New patient',
      });
    } else { setProgress(null); return; }
    const target = p.patient.kind === 'matched' && !separate ? openDraftOf(patient.id) : undefined;
    const id = target?.id ?? nextCaseId();
    const draft = { ...buildDraft(p, patient, user, demoNow(), target?.draft), id };
    saveRow({
      ...(target ?? { source: 'clinic' as const, createdBy: user.id }),
      id,
      patientId: patient.id,
      status: 'Draft',
      flag: undefined,
      draft,
      service: serviceSummary(draft, user),
      dentist: buildCtx(draft, user)?.prescriber?.name,
      labId: draft.lab,
      updatedAt: Date.now(),
    });
    // A card's Details opens the case at that part: a step id, or "item:<id>" for a service (its first open question).
    let step: string | undefined;
    if (typeof to === 'string') step = to;
    else if (to) {
      const s = p.services[to.service];
      const it = s?.product ? draft.items.find(i => i.product === s.product
        && (s.teeth.length ? s.teeth.some(t => i.teeth.includes(t)) : s.arch ? i.arch === s.arch : true)) : undefined;
      if (it) step = `item:${it.id}`;
    }
    navigate(`/flows/new-case/case/${id}`, { replace: true, state: { session: `ai-${Date.now()}`, step } });
  };
  const create = (to?: OpenTarget) => {
    if (progress !== null) return;
    setAttempted(true);
    // What was read is what's made: a changed description must be read again first.
    if (stale || reading) return;
    const p = parsed;
    if (!(p.patient.kind === 'matched' || newPatientReady(p, dob, demoNow()))) return;
    const reduce = typeof window.matchMedia === 'function' && window.matchMedia('(prefers-reduced-motion: reduce)').matches;
    if (reduce) { save(p, to); return; }
    setProgress(0);
    setAnnounce('Creating the case');
    [1, 2, 3].forEach(k => timers.current.push(window.setTimeout(() => setProgress(k), 300 * k)));
    timers.current.push(window.setTimeout(() => save(p, to), 1200));
  };
  // Details on a card: with a patient, create the case and open that part; before that, go to its line here.
  const openPart = (to: OpenTarget) => {
    if (progress !== null) return;
    if (!blocker) { create(to); return; }
    let re: RegExp | null = null;
    if (to === 'patient') re = /^\s*patient\b[^:\n]*:/i;
    else if (to === 'lab') re = /^\s*lab\b[^:\n]*:/i;
    else if (typeof to === 'object') re = new RegExp(`^\\s*(?:service|item)\\s*#?\\s*${to.service + 1}\\s*:`, 'i');
    let at = -1;
    let pos = 0;
    for (const l of textRef.current.split('\n')) {
      if (re && re.test(l)) { at = pos + l.length; break; }
      pos += l.length + 1;
    }
    focusAt(at >= 0 ? at : textRef.current.length);
  };

  const busy = progress !== null;
  // The same words the case's own footer uses: impressions by post (the default without a scan) → Ready for Dispatch.
  const finishLabel = (preview ? isPosted(recordsState(preview.draft, preview.ctx)) : !base?.scan) ? 'Ready for Dispatch' : 'Create Case';
  const details = (parsed.patient.kind !== 'none' ? 1 : 0) + (parsed.lab.kind !== 'default' ? 1 : 0)
    + parsed.services.filter(s => s.product).length + (parsed.delivery.date || parsed.delivery.fastTrack ? 1 : 0) + (parsed.instructions ? 1 : 0);
  const mod = isMac() ? '⌘' : 'Ctrl';

  return (
    <div className="relative h-full min-h-0">
      <style>{KEYFRAMES}</style>
      <p role="status" aria-live="polite" className="sr-only">{announce}</p>
      {/* Soft light behind the two cards. */}
      <div aria-hidden className="pointer-events-none absolute -inset-x-3 -inset-y-2 rounded-[28px] overflow-hidden">
        <div className="absolute inset-0 motion-safe:animate-[ai-drift_16s_ease-in-out_infinite]" style={{ background: AURORA }} />
      </div>

      {/* A prescription dropped on either card is read. */}
      {/* Until the first read, the description has the page to itself; what was understood slides in once it is read. */}
      <div className={`relative h-full grid gap-4 ${hasRead ? 'grid-cols-[minmax(0,58fr)_minmax(0,42fr)]' : 'grid-cols-1'}`} {...(busy ? {} : dropProps)}>
        {/* ── Left: the description ── */}
        <section aria-labelledby={`${uid}-title`} className={`${CARD} relative min-h-0 flex flex-col p-4`}>
          <div className="flex items-center gap-2">
            <AiChip />
            <h2 id={`${uid}-title`} className="text-[15px] leading-5 font-semibold text-[#030213]">Describe the case</h2>
            <button
              type="button"
              onClick={addService}
              disabled={busy}
              className={`ml-auto inline-flex items-center gap-1 h-7 px-2.5 rounded-lg text-xs font-semibold text-[#2F62D6] border border-[#C8D8FC] bg-[#F5F8FF] hover:bg-[#EEF4FF] hover:border-[#3F6FE8] transition-colors disabled:opacity-40 ${FOCUS}`}
            >
              <Plus className="w-3.5 h-3.5" strokeWidth={2.25} aria-hidden />Add Service {serviceN}
            </button>
          </div>
          <p id={`${uid}-help`} className="mt-1 text-xs leading-[18px] text-[#4A4A5A]">
            Fill in the template or write plain words, e.g. “Emax crown on 26, shade A2, patient Sarah Whitfield, deliver by 12 Nov”.
          </p>

          <div className="mt-3 flex-1 min-h-[150px] flex flex-col rounded-2xl p-[1.5px] bg-[#E0E0E6] focus-within:bg-[linear-gradient(120deg,#3F6FE8,#6A5CE8_50%,#59C1E3)] focus-within:shadow-[0_0_0_4px_rgba(106,92,232,0.14),0_16px_36px_-18px_rgba(63,111,232,0.6)] transition-shadow duration-200 motion-reduce:transition-none">
            <div className="flex-1 min-h-0 flex flex-col rounded-[14.5px] bg-white overflow-hidden">
              <label htmlFor={`${uid}-ta`} className="sr-only">Describe the case</label>
              <textarea
                id={`${uid}-ta`}
                ref={taRef}
                value={text}
                onChange={e => { setText(e.target.value); setUndo(null); }}
                onKeyDown={onKey}
                readOnly={busy}
                spellCheck={false}
                aria-describedby={`${uid}-help ${uid}-keys`}
                className="flex-1 min-h-0 w-full resize-none bg-transparent px-4 pt-3 pb-2 text-sm leading-6 text-[#030213] caret-[#6A5CE8] outline-none placeholder:text-[#8B8B9E]"
              />
              <div className="flex items-center gap-3 h-8 px-3 border-t border-[#ECECF2] bg-[#FAFAFD] text-[11px] text-[#5A5A6A]">
                {/* Speak instead of typing: the browser's speech recognition, or a demo dictation where there's none. */}
                <button
                  type="button"
                  onClick={() => { setAnnounce(dictation.state === 'idle' ? 'Listening. Say the case.' : 'Stopped listening.'); dictation.toggle(); }}
                  disabled={busy}
                  aria-pressed={dictation.state !== 'idle'}
                  aria-label={dictation.state === 'idle' ? 'Dictate the description' : 'Stop dictating'}
                  title={dictation.state === 'idle' ? (dictation.live ? 'Dictate' : 'Dictate (a demo dictation in this browser)') : 'Stop'}
                  className={`relative -ml-1 w-6 h-6 rounded-full inline-flex items-center justify-center flex-shrink-0 transition-colors motion-reduce:transition-none disabled:opacity-40 ${FOCUS} ${
                    dictation.state !== 'idle' ? 'bg-[#E5484D] text-white' : 'text-[#6A5CE8] bg-[#F3EEFF] hover:bg-[#E9E2FF]'
                  }`}
                >
                  {dictation.state !== 'idle' && <span aria-hidden className="absolute inset-0 rounded-full bg-[#E5484D]/40 motion-safe:animate-ping" />}
                  {dictation.state !== 'idle'
                    ? <Square className="relative w-2.5 h-2.5" fill="currentColor" aria-hidden />
                    : <Mic className="relative w-3.5 h-3.5" strokeWidth={2} aria-hidden />}
                </button>
                {dictation.state !== 'idle' ? (
                  <span className="min-w-0 inline-flex items-center gap-1.5 whitespace-nowrap overflow-hidden" aria-hidden>
                    <span className="font-semibold text-[#C0262D]">Listening</span>
                    {dictation.interim && <span className="truncate text-[#3A3A4A]">“{dictation.interim}”</span>}
                  </span>
                ) : (
                  <span className="inline-flex flex-shrink-0 items-center gap-1.5 whitespace-nowrap" aria-hidden>
                    {reading
                      ? <><Dots />Reading</>
                      : stale
                        ? <span className="text-[#8A4B08] font-semibold">Not read yet</span>
                        : details
                          ? <><Check className="w-3.5 h-3.5 text-[#2E7D32]" strokeWidth={2.5} />{plural(details, 'detail')} read</>
                          : <><Sparkles className="w-3.5 h-3.5 text-[#6A5CE8]" strokeWidth={2} />Type or speak</>}
                  </span>
                )}
                {undo && (
                  <button type="button" onClick={() => { setText(undo.text); setUndo(null); }} className={`inline-flex flex-shrink-0 items-center gap-1 font-semibold text-[#2F62D6] hover:underline whitespace-nowrap rounded ${FOCUS}`}>
                    <Undo2 className="w-3.5 h-3.5" aria-hidden />Undo {undo.what === 'example' ? 'Example' : 'Prescription'}
                  </button>
                )}
                {/* The keys as real buttons: Next Line (Enter) and Read Description ({mod} + Enter). Nothing runs on its own. */}
                <span id={`${uid}-keys`} className="sr-only">Enter moves to the next line. {mod} and Enter reads the description.</span>
                <span className="ml-auto flex flex-shrink-0 items-center gap-1.5">
                  {!undo && (
                    <button type="button" onClick={jumpNext} disabled={busy} title="Enter" className={`${MINI_BTN} border-[#E0E0E6] bg-white text-[#3A3A4A] hover:border-[#3F6FE8] hover:text-[#2F62D6]`}>
                      Next Line<CornerDownLeft className="w-3 h-3" strokeWidth={2.25} aria-hidden />
                    </button>
                  )}
                  <button
                    type="button"
                    onClick={read}
                    disabled={busy || reading}
                    title={`${mod} + Enter`}
                    className={`relative ${MINI_BTN} h-7 px-2.5 text-xs border-transparent ${GRADIENT_BTN} ${stale && !reading ? 'shadow-[0_0_0_3px_rgba(106,92,232,0.22)]' : ''}`}
                  >
                    {reading ? <Loader2 className="w-3.5 h-3.5 motion-safe:animate-spin" aria-hidden /> : <Sparkles className="w-3.5 h-3.5" strokeWidth={2} aria-hidden />}
                    {reading ? 'Reading…' : 'Read Description'}
                    <span className="inline-flex items-center gap-0.5 opacity-75 font-medium" aria-hidden>{mod}<CornerDownLeft className="w-3 h-3" strokeWidth={2.25} /></span>
                  </button>
                </span>
              </div>
            </div>
          </div>

          <div className="mt-2.5 flex flex-wrap items-center gap-1.5">
            <span className="text-[11px] font-semibold text-[#5A5A6A] mr-0.5" id={`${uid}-try`}>Try</span>
            {EXAMPLES.map(ex => (
              <button
                key={ex.id}
                type="button"
                disabled={busy}
                onClick={() => fill(ex.text, 'example')}
                aria-describedby={`${uid}-try`}
                className={`h-7 px-2.5 rounded-full border border-[#DCE6FD] bg-[#F5F8FF] text-[11px] font-semibold text-[#1E40AF] hover:border-[#3F6FE8] hover:bg-[#EEF4FF] transition-colors disabled:opacity-40 ${FOCUS}`}
              >
                {ex.label}
              </button>
            ))}
          </div>

          {/* Add Prescription / Order Form */}
          <input
            ref={fileRef}
            type="file"
            accept=".pdf,.jpg,.jpeg,.png,.heic,.webp,application/pdf,image/*"
            className="hidden"
            tabIndex={-1}
            aria-hidden
            onChange={e => { onFile(e.target.files?.[0]); e.target.value = ''; }}
          />
          {file ? (
            <div className={`mt-2.5 flex items-center gap-3 rounded-xl border px-3 py-2 ${file.state === 'read' ? 'border-[#BBF7D0] bg-[#F0FDF4]' : 'border-[#DDD3FB] bg-[#F8F5FF]'}`}>
              <span aria-hidden className="w-9 h-9 rounded-xl bg-white border border-[#E0E0E6] flex items-center justify-center flex-shrink-0">
                {file.state === 'reading' ? <Loader2 className="w-4 h-4 text-[#6A5CE8] motion-safe:animate-spin" /> : <FileText className="w-4 h-4 text-[#2E7D32]" strokeWidth={1.75} />}
              </span>
              <span className="min-w-0 flex-1">
                <span className="flex items-center gap-1.5 min-w-0">
                  <span className="truncate text-[13px] font-semibold text-[#030213]">{file.name}</span>
                  <span className="text-[11px] text-[#5A5A6A] whitespace-nowrap">· {file.size}</span>
                  {file.state === 'read' && <Tag tone="ok"><Check className="w-3 h-3" strokeWidth={3} aria-hidden />Read</Tag>}
                </span>
                {file.state === 'reading' ? (
                  <span className="mt-1.5 block" aria-hidden>
                    <span className={`block h-1.5 w-full rounded-full bg-[linear-gradient(90deg,#EDE7FE,#C9D6FB,#EDE7FE)] ${SHIMMER}`} />
                    <span className="mt-1 block text-[11px] text-[#5A5A6A]">Reading the patient, services, teeth and material…</span>
                  </span>
                ) : (
                  <span className="block text-[11px] text-[#166534]">Details filled into the description. Check them before you create the case.</span>
                )}
              </span>
              {file.state === 'read' && (
                <>
                  <LinkButton onClick={() => fileRef.current?.click()}>Replace</LinkButton>
                  <button type="button" onClick={() => setFile(null)} aria-label={`Remove ${file.name}`} className={`p-1 rounded text-[#5A5A6A] hover:text-[#030213] ${FOCUS}`}>
                    <X className="w-3.5 h-3.5" aria-hidden />
                  </button>
                </>
              )}
            </div>
          ) : (
            <button
              type="button"
              onClick={() => fileRef.current?.click()}
              disabled={busy}
              aria-describedby={fileError ? `${uid}-file-err` : undefined}
              className={`mt-2.5 w-full flex items-center gap-3 rounded-xl border-2 border-dashed px-3 py-2 text-left transition-colors motion-reduce:transition-none ${FOCUS} ${
                drag ? 'border-[#6A5CE8] bg-[#F3EEFF]' : 'border-[#C8D8FC] bg-gradient-to-r from-[#F5F8FF] to-[#F8F5FF] hover:border-[#6A5CE8]'
              }`}
            >
              <span aria-hidden className="w-9 h-9 rounded-xl bg-white border border-[#E0E0E6] shadow-sm flex items-center justify-center flex-shrink-0 text-[#6A5CE8]">
                <UploadCloud className="w-4 h-4" strokeWidth={1.9} />
              </span>
              <span className="min-w-0 flex-1">
                <span className="block text-[13px] font-semibold text-[#030213]">{drag ? 'Drop to Read It' : 'Add Prescription / Order Form'}</span>
                <span className="block text-[11px] text-[#5A5A6A] truncate">Upload manually · details auto-fetch into the description · PDF, JPG or PNG</span>
              </span>
              <span className="text-xs font-semibold text-[#2F62D6] flex-shrink-0" aria-hidden>Browse</span>
            </button>
          )}
          {fileError && <p id={`${uid}-file-err`} role="alert" className="mt-1 text-[11px] text-[#B42318]">{fileError}</p>}
        </section>

        {/* ── Right: what was understood (after the first read) ── */}
        {hasRead && (
        <section aria-labelledby={`${uid}-understood`} className={`${CARD} relative min-h-0 flex flex-col overflow-hidden motion-safe:animate-[ai-panel-in_320ms_ease-out]`}>
          <header className="flex items-center gap-2.5 px-4 pt-3 pb-2.5 border-b border-[#ECECF2]">
            <span aria-hidden className={`w-8 h-8 rounded-xl ${GRADIENT_BTN} flex items-center justify-center flex-shrink-0 shadow-[0_8px_18px_-8px_rgba(106,92,232,0.75)]`}>
              <Sparkles className="w-4 h-4" strokeWidth={2} />
            </span>
            <div className="min-w-0">
              <h2 id={`${uid}-understood`} className="text-sm font-semibold leading-5 text-[#030213] truncate">What Smile Genius understood</h2>
              <p className="text-[11px] leading-4 text-[#5A5A6A] truncate">Updates when you press Read Description. You check it all.</p>
            </div>
            <span className="ml-auto inline-flex items-center gap-1.5 text-[11px] font-semibold whitespace-nowrap" aria-hidden>
              {reading
                ? <span className="inline-flex items-center gap-1.5 text-[#5B21B6]"><Dots />Reading</span>
                : stale
                  ? <span className="inline-flex items-center gap-1.5 text-[#8A4B08]"><span className="w-1.5 h-1.5 rounded-full bg-[#E07B00]" />Changed since the last read</span>
                  : <span className="inline-flex items-center gap-1.5 text-[#166534]"><span className="w-1.5 h-1.5 rounded-full bg-[#2E7D32]" />Up to date</span>}
            </span>
          </header>

          <OpenContext.Provider value={openPart}>
          <div className={`flex-1 min-h-0 overflow-y-auto px-4 transition-opacity duration-200 motion-reduce:transition-none ${reading ? 'opacity-70' : ''}`}>
            <PatientField
              parsed={parsed}
              uid={uid}
              dob={dob}
              onDob={v => { setDobTyped(true); setDob(maskDOB(v)); }}
              showDobError={attempted || dob.replace(/\D/g, '').length === 8}
              openDraft={openDraft}
              separate={separate}
              onSeparate={setSeparate}
              onUse={pickPatient}
            />
            <LabField parsed={parsed} />
            {/* Grouped like the description: each service with its own teeth, material, delivery and instruction. */}
            <ServicesField parsed={parsed} preview={preview} user={user} blocks={nextServiceNumber(text) - 1} />
            {/* Only what's written for the whole case, outside any service. */}
            <InstructionField parsed={parsed} />
            {parsed.prescriber && (
              <Field icon={<Tile><Stethoscope className="w-4 h-4" strokeWidth={1.75} /></Tile>} label="Prescriber" tag={<Tag tone="ok"><Check className="w-3 h-3" strokeWidth={3} aria-hidden />Matched</Tag>}>
                <p className="text-sm font-semibold text-[#030213]">{userById(parsed.prescriber)?.name}</p>
              </Field>
            )}
            {parsed.unplaced.length > 0 && (
              <div className={`my-3 rounded-xl border border-dashed border-[#F5D98B] bg-[#FFFBEB] px-3 py-2.5 ${IN}`}>
                <p className="flex items-center gap-1.5 text-xs font-semibold text-[#8A4B08]">
                  <CircleHelp className="w-3.5 h-3.5" aria-hidden />I couldn’t place: {parsed.unplaced.map(u => `“${u}”`).join(', ')}
                </p>
                <p className="mt-0.5 text-[11px] text-[#5A5A6A]">Reword it, or put it on the Instruction line for the lab.</p>
              </div>
            )}
          </div>
          </OpenContext.Provider>

          <footer className="px-4 pt-2.5 pb-3 border-t border-[#ECECF2] bg-gradient-to-b from-white/0 to-[#F8F7FF]">
            <p id={`${uid}-next`} className={`mb-2 min-h-[16px] text-[11px] leading-4 ${blocker ? 'text-[#8A4B08]' : 'text-[#4A4A5A]'}`}>
              {blocker ?? (preview
                ? <>Opens at <span className="font-semibold text-[#030213]">{preview.opensAt}</span>{preview.gaps ? ` · ${plural(preview.gaps, 'thing')} left to fill` : ' · ready to review'}{base && openDraft ? ` · fills ${openDraft.id}` : ''}</>
                : null)}
            </p>
            <button
              type="button"
              onClick={() => create()}
              disabled={!!blocker || busy}
              aria-describedby={`${uid}-next`}
              className={`group relative w-full h-10 rounded-xl inline-flex items-center justify-center gap-2 text-sm font-semibold overflow-hidden ${GRADIENT_BTN} shadow-[0_10px_24px_-10px_rgba(63,111,232,0.75)] hover:opacity-95 transition-opacity disabled:opacity-40 disabled:shadow-none disabled:cursor-not-allowed ${FOCUS}`}
            >
              {!blocker && !busy && (
                <span aria-hidden className="absolute inset-0 bg-[linear-gradient(110deg,transparent_35%,rgba(255,255,255,0.32)_50%,transparent_65%)] bg-[length:250%_100%] motion-safe:animate-[ai-shimmer_3.2s_ease-in-out_infinite]" />
              )}
              <Sparkles className="relative w-4 h-4" strokeWidth={2} aria-hidden />
              <span className="relative">{finishLabel}</span>
            </button>
          </footer>

          {busy && (
            <div className="absolute inset-0 z-10 flex items-center justify-center bg-white/85 backdrop-blur-sm">
              <div className="w-[250px]" role="status" aria-live="polite">
                <p className="flex items-center gap-2 text-sm font-semibold text-[#030213] mb-3">
                  <span aria-hidden className={`w-7 h-7 rounded-lg ${GRADIENT_BTN} flex items-center justify-center`}><Sparkles className="w-3.5 h-3.5" strokeWidth={2} /></span>
                  Creating the case
                </p>
                <ol className="space-y-2">
                  {CREATE_STEPS.map((s, i) => {
                    const done = i < (progress ?? 0) || (i === CREATE_STEPS.length - 1 && (progress ?? 0) >= CREATE_STEPS.length - 1);
                    const now = i === progress && !done;
                    return (
                      <li key={s} className={`flex items-center gap-2.5 text-[13px] ${done || now ? 'text-[#030213]' : 'text-[#5A5A6A]'}`}>
                        {done
                          ? <span aria-hidden className="w-5 h-5 rounded-full bg-[#2E7D32] text-white flex items-center justify-center"><Check className="w-3 h-3" strokeWidth={3} /></span>
                          : now
                            ? <Loader2 aria-hidden className="w-5 h-5 text-[#6A5CE8] motion-safe:animate-spin" />
                            : <span aria-hidden className="w-5 h-5 rounded-full border-2 border-[#D4D4DD]" />}
                        <span className={now ? 'font-semibold' : ''}>{s}</span>
                        <span className="sr-only">{done ? ', done' : now ? ', in progress' : ''}</span>
                      </li>
                    );
                  })}
                </ol>
              </div>
            </div>
          )}
        </section>
        )}
      </div>
    </div>
  );
});
export default AiStart;

// ─── Pieces ──────────────────────────────────────────────────────────────────

function AiChip() {
  return (
    <span className={`inline-flex items-center gap-1 h-5 px-1.5 rounded-full text-[10px] font-bold tracking-wide ${GRADIENT_BTN}`}>
      <Sparkles className="w-3 h-3" strokeWidth={2.25} aria-hidden />AI
    </span>
  );
}
function Dots() {
  return (
    <span className="inline-flex gap-0.5" aria-hidden>
      {[0, 160, 320].map(d => (
        <span key={d} className="w-1 h-1 rounded-full bg-[#6A5CE8] motion-safe:animate-[ai-dot_1.2s_ease-in-out_infinite]" style={{ animationDelay: `${d}ms` }} />
      ))}
    </span>
  );
}

const TONE = {
  ok: 'bg-[#F0FDF4] text-[#166534] border-[#BBF7D0]',
  new: 'bg-[#EEF4FF] text-[#1E40AF] border-[#C8D8FC]',
  warn: 'bg-[#FFF8E1] text-[#8A4B08] border-[#F5D98B]',
  muted: 'bg-[#F3F3F5] text-[#4A4A5A] border-[#E0E0E6]',
  ai: 'bg-[#F3EEFF] text-[#5B21B6] border-[#DDD3FB]',
} as const;
function Tag({ tone, children }: { tone: keyof typeof TONE; children: ReactNode }) {
  return <span className={`inline-flex items-center gap-1 h-5 px-1.5 rounded-full text-[10px] font-semibold border whitespace-nowrap ${TONE[tone]}`}>{children}</span>;
}
function Tile({ children, tone = 'brand' }: { children: ReactNode; tone?: 'brand' | 'muted' }) {
  return (
    <span className={`w-8 h-8 rounded-lg flex items-center justify-center flex-shrink-0 ${tone === 'brand' ? 'bg-gradient-to-br from-[#EEF4FF] to-[#F3EEFF] border border-[#DCE6FD] text-[#2F62D6]' : 'bg-[#F3F3F5] border border-[#E0E0E6] text-[#6B6B7B]'}`}>
      {children}
    </span>
  );
}
/** Where a card's Details opens: that part of the case (or, before there's a patient, its line in the description). */
export type OpenTarget = 'patient' | 'lab' | 'review' | { service: number };
const OpenContext = createContext<((to: OpenTarget) => void) | null>(null);

/** A small "Details ›" that opens that part of the case in full. */
function DetailsLink({ to, what }: { to: OpenTarget; what: string }) {
  const open = useContext(OpenContext);
  if (!open) return null;
  return (
    <button
      type="button"
      onClick={() => open(to)}
      aria-label={'Open ' + what + ' in detail'}
      className={'inline-flex items-center gap-0.5 h-5 pl-1.5 pr-1 rounded-md text-[11px] font-semibold text-[#2F62D6] hover:bg-[#EEF4FF] whitespace-nowrap ' + FOCUS}
    >
      Details<ChevronRight className="w-3 h-3" strokeWidth={2.25} aria-hidden />
    </button>
  );
}

function Field({ icon, label, tag, children, k, to }: { icon: ReactNode; label: string; tag?: ReactNode; children: ReactNode; k?: string; to?: OpenTarget }) {
  return (
    <div className="flex gap-3 py-2 border-b border-[#F0F0F5] last:border-b-0" role="group" aria-label={label}>
      <div className="pt-0.5" aria-hidden>{icon}</div>
      <div className="flex-1 min-w-0">
        <div className="flex items-center gap-2 min-h-[18px]">
          <p className="text-[10px] font-bold uppercase tracking-widest text-[#5A5A6A]">{label}</p>
          {(tag || to) && (
            <span className="ml-auto flex items-center gap-1">
              {tag}
              {to && <DetailsLink to={to} what={label.toLowerCase()} />}
            </span>
          )}
        </div>
        <div key={k} className={`mt-0.5 ${IN}`}>{children}</div>
      </div>
    </div>
  );
}
const Muted = ({ children }: { children: ReactNode }) => <p className="text-xs text-[#5A5A6A]">{children}</p>;
/** A field still waiting on the description: the orange circle with its ripple. */
function NeedsYou() {
  return (
    <span className="inline-flex items-center gap-1.5 text-[11px] font-semibold text-[#8A4B08] whitespace-nowrap">
      <StateIcon state="gap" size="sm" />Needs you
    </span>
  );
}
function Warn({ children }: { children: ReactNode }) {
  return (
    <p className="mt-1 flex items-start gap-1.5 text-[11px] leading-4 text-[#8A4B08]">
      <AlertTriangle className="w-3 h-3 mt-0.5 flex-shrink-0 text-[#B45309]" aria-hidden />
      <span>{children}</span>
    </p>
  );
}

// ─── Fields ──────────────────────────────────────────────────────────────────

function PatientField({ parsed, uid, dob, onDob, showDobError, openDraft, separate, onSeparate, onUse }: {
  parsed: Parsed; uid: string; dob: string; onDob: (v: string) => void; showDobError: boolean;
  openDraft?: CaseRow; separate: boolean; onSeparate: (v: boolean) => void; onUse: (p: Patient, heard: string) => void;
}) {
  const p = parsed.patient;
  const now = demoNow();
  if (p.kind === 'none') {
    return (
      <Field icon={<Tile tone="muted"><UserRound className="w-4 h-4" strokeWidth={1.75} /></Tile>} to="patient" label="Patient" tag={<NeedsYou />} k="none">
        <Muted>Write the patient’s name on the first line. Someone new is added for you.</Muted>
      </Field>
    );
  }
  if (p.kind === 'several') {
    return (
      <Field icon={<Tile><UserRound className="w-4 h-4" strokeWidth={1.75} /></Tile>} to="patient" label="Patient" tag={<Tag tone="warn">Which one?</Tag>} k={`several-${p.heard}`}>
        <p className="text-xs text-[#1F1F2E]">More than one {p.heard} in the practice:</p>
        <div className="mt-1.5 flex flex-wrap gap-1.5">
          {p.options.map(o => (
            <button key={o.id} type="button" onClick={() => onUse(o, p.heard)} className={`inline-flex items-center gap-1.5 h-7 pl-1 pr-2.5 rounded-full border border-[#D4D4DD] bg-white hover:border-[#3F6FE8] text-xs font-semibold text-[#030213] ${FOCUS}`}>
              <Avatar p={o} small />{fullName(o)}<span className="font-normal text-[#5A5A6A]">{o.dob}</span>
            </button>
          ))}
        </div>
      </Field>
    );
  }
  if (p.kind === 'matched') {
    const pt = p.patient;
    const scan = openDraft?.source === 'scanner' && openDraft.scanLabel;
    return (
      <Field icon={<Avatar p={pt} />} to="patient" label="Patient" tag={<Tag tone="ok"><Check className="w-3 h-3" strokeWidth={3} aria-hidden />Matched</Tag>} k={`m-${pt.id}`}>
        <p className="text-sm font-semibold text-[#030213] truncate">{fullName(pt)}</p>
        <p className="text-[11px] text-[#4A4A5A] truncate">DOB {pt.dob} · {patientAge(pt, now)} · {pt.id}{pt.funding === 'nhs' ? ' · NHS' : ''}</p>
        {p.dobMismatch && <Warn>The date of birth you wrote doesn’t match {pt.first}’s record ({pt.dob}). Check it’s the same person.</Warn>}
        {openDraft && (
          <div className="mt-1.5 flex items-start gap-2 rounded-lg bg-[#F5F8FF] border border-[#DCE6FD] px-2.5 py-1.5 text-[11px] leading-4 text-[#1F1F2E]">
            <ScanLine className="w-3.5 h-3.5 mt-px flex-shrink-0 text-[#2F62D6]" aria-hidden />
            <span className="min-w-0">
              {separate
                ? <>A separate case. {scan ? `The ${scan} scan` : 'The open draft'} stays in {openDraft.id}. </>
                : <>Fills {pt.first}’s {scan ? `${scan} scan draft` : 'open draft'} ({openDraft.id}), so it goes with this case. </>}
              <LinkButton onClick={() => onSeparate(!separate)}>{separate ? 'Fill the Open Draft Instead' : 'Start a Separate Case'}</LinkButton>
            </span>
          </div>
        )}
      </Field>
    );
  }
  // A new patient: needs a date of birth, right here.
  const check = parseDOB(dob, now);
  const err = showDobError ? check.error : undefined;
  const id = `${uid}-dob`;
  return (
    <Field icon={<span aria-hidden className={`w-8 h-8 rounded-full ${GRADIENT_BTN} flex items-center justify-center`}><UserPlus className="w-4 h-4" strokeWidth={1.9} /></span>} to="patient" label="Patient" tag={<Tag tone="new">New patient</Tag>} k={`n-${p.first}-${p.last}`}>
      <p className="text-sm font-semibold text-[#030213] truncate">{`${p.first} ${p.last}`.trim()}</p>
      {!p.last ? (
        <Warn>Add the surname too, e.g. “{p.first} Whitfield”.</Warn>
      ) : (
        <>
          <div className="mt-1.5 flex items-center gap-2">
            <label htmlFor={id} className="text-[11px] font-semibold text-[#3A3A4A] whitespace-nowrap">Date of birth</label>
            <input
              id={id}
              inputMode="numeric"
              autoComplete="off"
              placeholder="dd/mm/yyyy"
              value={dob}
              onChange={e => onDob(e.target.value)}
              aria-invalid={!!err || undefined}
              aria-describedby={err ? `${id}-err` : `${id}-hint`}
              className={`h-8 w-[118px] rounded-lg border bg-white px-2.5 text-[13px] tabular-nums text-[#030213] placeholder:text-[#8B8B9E] outline-none focus:ring-2 focus:ring-[#3F6FE8]/25 ${err ? 'border-[#D92D20] focus:border-[#D92D20]' : 'border-[#D4D4DD] focus:border-[#3F6FE8]'}`}
            />
            {!check.error && <Check className="w-4 h-4 text-[#2E7D32]" strokeWidth={2.5} aria-label="Date of birth looks right" />}
          </div>
          {err
            ? <p id={`${id}-err`} className="mt-1 text-[11px] text-[#B42318]">{err}</p>
            : <p id={`${id}-hint`} className="mt-1 text-[11px] text-[#5A5A6A]">{check.warning ?? 'Added to the practice when you create the case.'}</p>}
        </>
      )}
      {p.suggest && (
        <p className="mt-1 text-[11px] text-[#4A4A5A]">
          Did you mean <LinkButton onClick={() => onUse(p.suggest!, p.heard)}>{fullName(p.suggest)}</LinkButton>?
        </p>
      )}
    </Field>
  );
}

function LabTile({ lab }: { lab: Lab }) {
  return <span aria-hidden className={`w-8 h-8 rounded-lg flex items-center justify-center flex-shrink-0 text-[11px] font-bold ${lab.avatar}`}>{lab.initials}</span>;
}
function LabField({ parsed }: { parsed: Parsed }) {
  const l = parsed.lab;
  if (l.kind === 'unknown') {
    return (
      <Field icon={<Tile tone="muted"><FlaskConical className="w-4 h-4" strokeWidth={1.75} /></Tile>} to="lab" label="Lab" tag={<Tag tone="warn">Not one of your labs</Tag>} k={`u-${l.heard}`}>
        <p className="text-sm font-semibold text-[#030213] truncate">“{l.heard}”</p>
        <Muted>You’ll pick from your labs when the case opens.</Muted>
      </Field>
    );
  }
  return (
    <Field
      icon={<LabTile lab={l.lab} />}
      to="lab"
      label="Lab"
      tag={l.kind === 'matched' ? <Tag tone="ok"><Check className="w-3 h-3" strokeWidth={3} aria-hidden />Matched</Tag> : <Tag tone="muted">{l.src}</Tag>}
      k={`${l.kind}-${l.lab.id}`}
    >
      <p className="text-sm font-semibold text-[#030213] truncate">{l.lab.name}</p>
      <p className="text-[11px] text-[#4A4A5A] truncate">{l.lab.city}{l.kind === 'default' ? ' · no lab named' : ''}</p>
    </Field>
  );
}

function ToothChip({ label, pontic }: { label: string; pontic?: boolean }) {
  return (
    <span className={`inline-flex items-center gap-1 h-5 px-1.5 rounded-md border text-[11px] font-semibold tabular-nums text-[#0B4F66] ${pontic ? 'bg-[rgba(89,193,227,0.08)] border-dashed border-[#2A8DB0]' : 'bg-[rgba(89,193,227,0.18)] border-[#3FA8CA]'}`}>
      <span aria-hidden className={`w-2 h-2 rounded-full ${pontic ? 'border border-dashed border-[#2A8DB0]' : 'bg-[rgba(89,193,227,0.62)] border border-[#3FA8CA]'}`} />
      {label}{pontic && <span className="font-medium text-[#2A6F86]">pontic</span>}
    </span>
  );
}
function Row({ label, children }: { label: string; children: ReactNode }) {
  return (
    <div className="flex items-start gap-2">
      <dt className="w-[62px] flex-shrink-0 pt-0.5 text-[11px] text-[#5A5A6A]">{label}</dt>
      <dd className="min-w-0 flex-1 flex flex-wrap items-center gap-1">{children}</dd>
    </div>
  );
}
const Pick = () => <span className="text-[11px] text-[#5A5A6A]">You’ll pick it</span>;
/** A pending item: the orange circle (inline, without the ripple) and what's missing. */
const Need = ({ children }: { children: ReactNode }) => (
  <span className="inline-flex items-center gap-1 text-[11px] font-semibold text-[#8A4B08]">
    <StateIcon state="gap" size="sm" ripple={false} />{children}
  </span>
);

/**
 * One card per service, in the description's order and grouping: a "Service N"
 * block that's still empty shows as an empty card, so the panel mirrors the
 * template. Each card carries its own teeth, material/shade, delivery (its own
 * back-by date, or the needed-by date it was given) and instruction.
 */
function ServicesField({ parsed, preview, user, blocks }: { parsed: Parsed; preview: Preview | null; user: User; blocks: number }) {
  const list = parsed.services;
  const items = preview?.items ?? [];
  // Each item's own back-by date at this lab (delivery lives with the service).
  const own = new Map((preview ? caseDates(preview.draft, preview.ctx, { items }).perItem : []).map(x => [x.id, x.backBy]));
  const count = Math.max(blocks, list.length, 1);
  let k = 0;
  return (
    <Field
      icon={<Tile><Sparkles className="w-4 h-4" strokeWidth={1.75} /></Tile>}
      label={count > 1 ? `Services · ${count}` : 'Service'}
      tag={list.length === 0 ? <NeedsYou /> : undefined}
      k={`svc-${count}`}
    >
      <div className="mt-1 space-y-2">
        {Array.from({ length: count }, (_, i) => {
          const s = list[i];
          if (!s) return <EmptyServiceCard key={`empty-${i}`} index={i} />;
          const item = s.product ? items[k++] : undefined;
          return (
            <ServiceCard
              key={s.key}
              s={s}
              index={i}
              item={item}
              ctx={preview?.ctx}
              lab={parsed.lab.lab}
              user={user}
              backBy={item ? own.get(item.id) : undefined}
              fastOffered={preview?.fastTrack}
            />
          );
        })}
      </div>
    </Field>
  );
}

/** A "Service N" block with nothing written in it yet. */
function EmptyServiceCard({ index }: { index: number }) {
  return (
    <div className="rounded-xl border border-dashed border-[#DCDCE6] bg-white/60 px-2.5 py-2">
      <div className="flex items-center gap-2 min-w-0">
        <span aria-hidden className="w-7 h-7 rounded-lg flex items-center justify-center flex-shrink-0 bg-[#F8F9FC] border border-[#ECECF2] text-[#8B8B9E]">
          <CircleHelp className="w-3.5 h-3.5" strokeWidth={1.9} />
        </span>
        <p className="min-w-0 truncate text-[13px] font-semibold text-[#5A5A6A]">Service {index + 1}</p>
        <span className="ml-auto"><DetailsLink to={{ service: index }} what={`service ${index + 1}`} /></span>
      </div>
      <p className="mt-1 text-[11px] leading-4 text-[#5A5A6A]">Write what to make on its line, e.g. “Crown”, then its teeth, material/shade, delivery and instruction.</p>
    </div>
  );
}

function ServiceCard({ s, index, item, ctx, lab, user, backBy, fastOffered }: {
  s: ServiceRead; index: number; item?: ServiceItem; ctx?: Ctx; lab: Lab; user: User; backBy?: Date; fastOffered?: boolean;
}) {
  const n = user.notation;
  const Icon = s.product ? PRODUCT_ICON[s.product] : CircleHelp;
  const eff = item && ctx ? effective(item, ctx) : undefined;
  const slot = s.product ? optSlotOf(s.product) : undefined;
  const needsTeeth = !!s.product && ['crown', 'bridge', 'veneer', 'inlay', 'implant', 'partial'].includes(s.product);
  const archItem = !!s.product && (PRODUCTS[s.product].archItem || s.product === 'partial' || s.product === 'reline');
  const others = s.product && !s.makes ? labsThatMake(s.product).filter(l => l.id !== lab.id) : [];
  const metal = eff?.material === 'metal';
  // A full denture: its stage plan stands in for the Delivery row; the tooth shade only once teeth are set up (Try In on, or a finished denture).
  const denture = s.product === 'denture';
  const shadeAsked = !denture || !!s.shade || (item && ctx
    ? slotsFor(item, ctx).some(x => x.id === 'shade')
    : (s.treatment ?? 'staged') !== 'staged' || !!s.stages?.some(r => r.state === 'order' && r.id !== 'tray' && r.id !== 'blocks'));

  let optionView: ReactNode = null;
  if (s.product && slot) {
    if (s.option?.ok) {
      optionView = <><span className="text-xs font-semibold text-[#030213]">{s.option.name}</span><Tag tone="ok"><Check className="w-3 h-3" strokeWidth={3} aria-hidden />Matched</Tag></>;
    } else if (s.option) {
      optionView = <><span className="text-xs font-semibold text-[#8A4B08] line-through decoration-[#B45309]/50">{s.option.name}</span><Need>{s.option.reason}</Need></>;
    } else if (slot === 'material' && eff?.material) {
      optionView = <><span className="text-xs font-semibold text-[#030213]">{optionName(s.product, eff.material)}</span>{eff.matSrc && <Tag tone="muted">{eff.matSrc}</Tag>}</>;
    } else if (slot === 'type' && eff?.type) {
      optionView = <><span className="text-xs font-semibold text-[#030213]">{optionName(s.product, eff.type)}</span>{eff.typeSrc && <Tag tone="muted">{eff.typeSrc}</Tag>}</>;
    } else optionView = <Pick />;
  }

  return (
    <div className="rounded-xl border border-[#ECECF2] bg-[#FAFBFF] px-2.5 py-2">
      <div className="flex items-center gap-2 min-w-0">
        <span aria-hidden className={`w-7 h-7 rounded-lg flex items-center justify-center flex-shrink-0 ${s.product ? 'bg-white border border-[#DCE6FD] text-[#2F62D6]' : 'bg-[#FFF8E1] border border-[#F5D98B] text-[#B45309]'}`}>
          <Icon className="w-3.5 h-3.5" strokeWidth={1.9} />
        </span>
        <p className="min-w-0 truncate text-[13px] font-semibold text-[#030213]">
          <span className="sr-only">Service {index + 1}: </span>
          {s.product ? PRODUCTS[s.product].label : 'What should the lab make?'}
        </p>
        <span className="ml-auto flex items-center gap-1 flex-shrink-0">
          {s.assumed && <Tag tone="ai">Read as a crown</Tag>}
          {s.product && !s.makes && <Tag tone="warn">Lab can’t make this</Tag>}
          <DetailsLink to={{ service: index }} what={s.product ? PRODUCTS[s.product].noun : `service ${index + 1}`} />
        </span>
      </div>
      <dl className="mt-1.5 space-y-1">
        {(s.bridge || s.teeth.length > 0 || needsTeeth) && (
          <Row label={s.product === 'bridge' ? 'Span' : s.product === 'partial' ? 'Replacing' : 'Teeth'}>
            {s.bridge
              ? <>{s.teeth.map(t => <ToothChip key={t} label={toothText(t, n)} pontic={s.bridge!.pontics.includes(t)} />)}<span className="text-[11px] text-[#5A5A6A]">{plural(s.teeth.length, 'unit')}</span></>
              : s.teeth.length
                ? s.teeth.map(t => <ToothChip key={t} label={toothText(t, n)} />)
                : <Need>Which {s.product === 'bridge' ? 'end teeth' : 'teeth'}?</Need>}
          </Row>
        )}
        {archItem && (
          <Row label="Arch">
            {s.arch
              ? <span className="inline-flex items-center h-5 px-1.5 rounded-md border border-[#3FA8CA] bg-[rgba(89,193,227,0.18)] text-[11px] font-semibold text-[#0B4F66]">{archCaps(s.arch)}</span>
              : <Need>Which arch?</Need>}
          </Row>
        )}
        {s.product && slot && <Row label={SLOT_LABEL[slot]}>{optionView}</Row>}
        {s.product === 'partial' && (
          <Row label="Stage">{s.stage ? <span className="text-xs font-semibold text-[#030213]">{s.stage.name}</span> : <Pick />}</Row>
        )}
        {s.product === 'inlay' && (
          <Row label="Type">{s.inlayType ? <span className="text-xs font-semibold text-[#030213]">{s.inlayType === 'inlay' ? 'Inlay' : 'Onlay'}</span> : <Pick />}</Row>
        )}
        {denture && <Row label="Stages"><StageList s={s} item={item} ctx={ctx} /></Row>}
        {s.product && takesShade(s.product) && !metal && shadeAsked && (
          <Row label="Shade">
            {s.shade
              ? <span className="inline-flex items-center gap-1 h-5 pl-1 pr-1.5 rounded-md border border-[#E0E0E6] bg-white text-[11px] font-semibold text-[#030213]">
                  <span aria-hidden className="w-3 h-3 rounded-full border border-black/10" style={{ background: shadeSwatch(s.shade) }} />{s.shade}
                </span>
              : <Pick />}
            {s.stump && <span className="text-[11px] text-[#4A4A5A]">stump {s.stump}</span>}
          </Row>
        )}
        {s.product === 'other' && s.desc && <Row label="What"><span className="text-xs text-[#1F1F2E]">{s.desc}</span></Row>}
        {/* This service's own Delivery and Instruction, as written in its block (a denture's days are its stages'). */}
        {s.product && !denture && (
          <Row label="Delivery">
            {s.delivery?.date ? (
              <>
                <span className="text-xs font-semibold text-[#030213]">Needed by {fmtDay(s.delivery.date)}</span>
                {backBy && (backBy.getTime() <= s.delivery.date.getTime()
                  ? <Tag tone="ok"><Check className="w-3 h-3" strokeWidth={3} aria-hidden />On time</Tag>
                  : <Tag tone="warn">Back {fmtDay(backBy)} at the earliest</Tag>)}
              </>
            ) : backBy ? (
              <><span className="text-xs font-semibold text-[#030213]">Back by {fmtDay(backBy)}</span><Tag tone="muted">Calculated</Tag></>
            ) : (
              <span className="text-[11px] text-[#5A5A6A]">From the lab’s turnaround</span>
            )}
            {s.delivery?.fastTrack && (fastOffered === false
              ? <Tag tone="warn">Fast-Track not offered</Tag>
              : <Tag tone="ok"><Zap className="w-3 h-3" aria-hidden />Fast-Track</Tag>)}
          </Row>
        )}
        {s.product && (
          <Row label="Instruction">
            {s.note
              ? <span className="text-xs leading-[17px] text-[#1F1F2E] line-clamp-2">{s.note}</span>
              : <span className="text-[11px] text-[#5A5A6A]">None</span>}
          </Row>
        )}
        {!s.product && s.heard && <Row label="Heard"><span className="text-xs text-[#1F1F2E] truncate">“{s.heard}”</span></Row>}
      </dl>
      {s.product && !s.makes && (
        <Warn>{lab.name} doesn’t make {PRODUCTS[s.product].noun}s.{others.length ? ` ${others.map(l => l.name).join(' or ')} ${others.length === 1 ? 'does' : 'do'}.` : ''}</Warn>
      )}
      {!s.product && <Warn>Add the product on its Service line, e.g. “Crown”, “Bridge” or “Night guard”.</Warn>}
      {s.issues.map(x => <Warn key={x}>{x}</Warn>)}
    </div>
  );
}

/**
 * A full denture's plan, a line for each stage in play: ordered with its
 * needed-by day (checked against the lab's day for that stage, or the lab's
 * day itself when none was written), done elsewhere, or done here on the
 * patient's earlier case. With a patient it's the plan as the case opens.
 */
function StageList({ s, item, ctx }: { s: ServiceRead; item?: ServiceItem; ctx?: Ctx }) {
  const treatment = item ? dentureTreatment(item) : s.treatment ?? 'staged';
  const rows: { id: DentureStageId; state: StagePlan['state']; date?: Date; caseId?: string }[] = item
    ? stagePlan(item).map(r => ({ id: r.id, state: r.state, date: r.date ? fromISO(r.date) : undefined, caseId: r.caseId }))
    : s.stages ?? [];
  if (!rows.length) return <Need>Which stages?</Need>;
  const sugg = item && ctx && s.makes ? suggestedStageDates(item, ctx) : undefined;
  const written = (id: DentureStageId) => !!s.stages?.some(r => r.id === id && r.date);
  return (
    <ol className="w-full space-y-1">
      {rows.map(r => {
        const name = treatment === 'staged' ? stageName(r.id) : treatmentName(treatment);
        const lab = item && ctx && s.makes ? optionAvail(ctx.lab, 'denture', stageOption(item, r.id), ctx.funding) : undefined;
        const due = sugg?.[r.id] ? fromISO(sugg[r.id]) : undefined;
        return (
          <li key={r.id} className="flex flex-wrap items-center gap-x-1.5 gap-y-0.5 min-h-5">
            <StageMark n={treatment === 'staged' ? DENTURE_STAGES.findIndex(x => x.id === r.id) + 1 : 1} state={r.state} />
            <span className="text-xs font-semibold text-[#030213]">{name}</span>
            {r.state === 'order' ? (
              <>
                {r.date ? <span className="text-[11px] text-[#3A3A4A]">needed by {fmtDay(r.date)}</span> : <Need>Pick a day</Need>}
                {lab && !lab.ok ? <Need>{lab.reason}</Need>
                  : !r.date || !due ? null
                    : !written(r.id) ? <Tag tone="muted">Suggested</Tag>
                      : r.date >= due ? <Tag tone="ok"><Check className="w-3 h-3" strokeWidth={3} aria-hidden />On time</Tag>
                        : <Tag tone="warn">Back {fmtDay(due)} at the earliest</Tag>}
              </>
            ) : r.state === 'here' ? (
              <Tag tone="ok">Done here{r.caseId ? ` · ${r.caseId}` : ''}</Tag>
            ) : (
              <><Tag tone="muted">Done elsewhere</Tag>{r.date && <span className="text-[11px] text-[#5A5A6A]">on {r.date.getFullYear() === demoNow().getFullYear() ? fmtShort(r.date) : fmtFull(r.date)}</span>}</>
            )}
          </li>
        );
      })}
    </ol>
  );
}
/** A stage's marker: its number while ordered, a check once done (here: filled). */
function StageMark({ n, state }: { n: number; state: StagePlan['state'] }) {
  const tone = state === 'order' ? 'bg-[#3F6FE8] text-white' : state === 'here' ? 'bg-[#2E7D32] text-white' : 'bg-[#E8F5E9] border border-[#A5D6A7] text-[#2E7D32]';
  return (
    <span aria-hidden className={`w-4 h-4 rounded-full flex-shrink-0 flex items-center justify-center text-[9px] font-bold tabular-nums ${tone}`}>
      {state === 'order' ? n : <Check className="w-2.5 h-2.5" strokeWidth={3} />}
    </span>
  );
}

function InstructionField({ parsed }: { parsed: Parsed }) {
  const t = parsed.instructions;
  // Each service's own instruction shows on its card; this row only appears for something about the whole case.
  if (!t) return null;
  return (
    <Field icon={<Tile><MessageSquareText className="w-4 h-4" strokeWidth={1.75} /></Tile>} to="review" label="Instruction" tag={t ? <Tag tone="ok"><Check className="w-3 h-3" strokeWidth={3} aria-hidden />For the lab</Tag> : undefined} k={t ? 'i' : 'none'}>
      {t ? <p className="text-xs leading-[18px] text-[#1F1F2E] whitespace-pre-wrap line-clamp-4">{t}</p> : <Muted>None yet. Each service has its own Instruction line.</Muted>}
    </Field>
  );
}

function Avatar({ p, small }: { p: Patient; small?: boolean }) {
  return (
    <span aria-hidden className={`${small ? 'w-5 h-5 text-[9px]' : 'w-8 h-8 text-[11px]'} rounded-full ${GRADIENT_BTN} font-semibold flex items-center justify-center flex-shrink-0`}>
      {p.first[0]}{p.last[0]}
    </span>
  );
}
