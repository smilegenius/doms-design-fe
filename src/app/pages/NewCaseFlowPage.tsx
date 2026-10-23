// ─── New Case Flow · case page ───────────────────────────────────────────────
// The simplest way for a clinic to create lab work. This page owns the case:
// state, auto-advance to the next gap, saving, sending (the prescriber's
// signature with a 10-second Undo), approval and the keyboard. It renders one of
// three experiences on top (layouts/: Guided, Conversation, Canvas), all from
// the same CaseContext + controller, so every rule behaves the same in each.
//
// Lives in the Flows section only (/flows/new-case/*), with its own demo store,
// so the portal's Cases list and existing wizards are untouched.

import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { useLocation, useNavigate, useParams, useSearchParams } from 'react-router-dom';
import { useToast } from '../context/ToastContext';
import ModalPortal from '../components/ModalPortal';
import FlowFrame from '../newCase/FlowFrame';
import { CaseApi, CaseContext, DrawerState } from '../newCase/CaseContext';
import { CLINIC, Funding, LabId, ProductId, labById, userById } from '../newCase/data';
import { demoTimeOf, fmtDay, fmtTime, fromISO, toISO } from '../newCase/dates';
import {
  CaseDraft, PRODUCTS, ServiceItem, SlotId, buildSteps, caseDates, effective, firstGap, fitCheck, gapCount, isPosted,
  itemPhrase, labMakes, nextGap, notesFor, optionAvail, optionName, parseStep, recordsState, sendMode,
  splitSuggestion, defaultBox, plural, itemTitle, sendLabel, Ctx,
} from '../newCase/rules';
import {
  CaseRow, addEvent, blankDraft, getPatient, getRow, learnLogin, loginMap, newItem, nextCaseId, removeRow, restore, saveRow,
  saveRows, snapshot, useFlowStore, Snapshot,
} from '../newCase/store';
import { buildCtx, serviceSummary } from '../newCase/derive';
import { CaseController, CaseView, ControllerContext } from '../newCase/controller';
import GuidedLayout from '../newCase/layouts/GuidedLayout';
import ConversationLayout from '../newCase/layouts/ConversationLayout';
import CanvasLayout from '../newCase/layouts/CanvasLayout';
import Drawers from '../newCase/Drawers';
import BlankStart from '../newCase/BlankStart';
import SentView, { SentResult, UndoToast } from '../newCase/SentView';
import { SecondaryButton, FOCUS } from '../newCase/ui';

type View = CaseView;

export default function NewCaseFlowPage() {
  const { id = 'new' } = useParams();
  const location = useLocation();
  const state = (location.state ?? {}) as { session?: string };
  const key = state.session ?? id;
  return (
    <FlowFrame collapsed>
      <CaseLoader key={key} id={id} sessionKey={key} />
    </FlowFrame>
  );
}

function CaseLoader({ id, sessionKey }: { id: string; sessionKey: string }) {
  const [sp] = useSearchParams();
  // Where to open: the AI page's Details passes a step (or "item:<id>" for a service).
  const startStep = (useLocation().state as { step?: string } | null)?.step;
  const store = useFlowStore();
  const user = userById(store.userId)!;
  const initial = useMemo(() => {
    const row = id !== 'new' ? getRow(id) : undefined;
    if (row?.draft) return { draft: row.draft, row };
    const p = getPatient(sp.get('patient') ?? '');
    return p ? { draft: blankDraft(p), row: undefined } : null;
    // Loaded once per case session.
  }, []); // eslint-disable-line react-hooks/exhaustive-deps
  // Start from scratch: no patient yet, so the blank page asks who it's for.
  if (!initial && id === 'new' && !sp.get('patient')) return <BlankStart />;
  if (!initial) {
    return (
      <div className="p-10 max-w-lg">
        <h1 className="text-xl font-semibold text-[#030213] mb-2">That case isn’t in this demo</h1>
        <p className="text-sm text-[#4A4A5A]">It may have been deleted, or the demo data was reset. Go back to Lab Work to pick another.</p>
      </div>
    );
  }
  return <CaseEditor initial={initial.draft} row={initial.row} user={user} sessionKey={sessionKey} startStep={startStep} />;
}

function initialView(row: CaseRow | undefined, userId: string): View {
  if (!row) return 'edit';
  if (row.flag === 'Awaiting approval') return row.draft?.prescriber === userId ? 'approve' : 'waiting';
  if (row.status !== 'Draft') return 'sent';
  return 'edit';
}

/** Items whose current choice isn't offered on the NHS. */
function nhsConflicts(d: CaseDraft, ctx: Ctx): { item: ServiceItem; slot: SlotId; name: string }[] {
  const out: { item: ServiceItem; slot: SlotId; name: string }[] = [];
  for (const it of d.items) {
    if (PRODUCTS[it.product].privateOnly) continue;
    const e = effective(it, { ...ctx, funding: 'private' });
    const check = (slot: SlotId, opt?: string) => {
      if (opt && !optionAvail(ctx.lab, it.product, opt, 'nhs', it).ok) out.push({ item: it, slot, name: optionName(it.product, opt) });
    };
    if (['crown', 'bridge', 'inlay'].includes(it.product)) check('material', e.material);
    if (it.product === 'nightguard' || it.product === 'retainer') check('type', e.type);
    if (it.product === 'denture') check('stage', it.stage);
    if (it.product === 'partial') check('base', it.base);
    if (it.product === 'reline') check('work', it.work);
  }
  return out;
}
function reopenFor(d: CaseDraft, conflicts: ReturnType<typeof nhsConflicts>): CaseDraft {
  return {
    ...d,
    items: d.items.map(it => {
      const mine = conflicts.filter(c => c.item.id === it.id);
      if (!mine.length) return it;
      const n: ServiceItem = { ...it, reopen: [...new Set([...(it.reopen ?? []), ...mine.map(m => m.slot)])] };
      for (const m of mine) {
        if (m.slot === 'material') { n.material = undefined; n.matSrc = undefined; }
        if (m.slot === 'type') { n.type = undefined; n.typeSrc = undefined; }
        if (m.slot === 'stage') n.stage = undefined;
        if (m.slot === 'base') n.base = undefined;
        if (m.slot === 'work') n.work = undefined;
      }
      return n;
    }),
  };
}
const resetChecks = (i: ServiceItem): ServiceItem => ({
  ...i, remake: undefined, remakeReason: undefined, implantDecision: undefined,
  material: i.matSrc === 'Made the original' ? undefined : i.material, matSrc: i.matSrc === 'Made the original' ? undefined : i.matSrc,
  shade: i.shadeSrc === 'Made the original' ? undefined : i.shade, shadeSrc: i.shadeSrc === 'Made the original' ? undefined : i.shadeSrc,
});

function CaseEditor({ initial, row: initialRow, user, sessionKey, startStep }: {
  initial: CaseDraft; row?: CaseRow; user: ReturnType<typeof userById> & object; sessionKey: string; startStep?: string;
}) {
  const navigate = useNavigate();
  const { toast } = useToast();
  const store = useFlowStore();
  const [draft, setDraft] = useState<CaseDraft>(initial);
  const [view, setView] = useState<View>(() => initialView(initialRow, user.id));
  const actingUser = user;
  const derived = buildCtx(draft, actingUser);
  const ctx = derived!.ctx;
  const prescriber = derived!.prescriber;
  const patient = ctx.patient;
  const lab = labById(draft.lab);
  const readOnly = view !== 'edit';

  const [step, setStep] = useState<string>(() => {
    if (initialView(initialRow, user.id) !== 'edit') return 'review';
    const steps0 = buildSteps(initial, ctx, '');
    // A requested start: a step, or a service's first open question (else its first).
    if (startStep?.startsWith('item:')) {
      const nodes = steps0.filter(s => s.itemId === startStep.slice(5));
      const at = nodes.find(s => s.gap && s.navigable) ?? nodes[0];
      if (at) return at.id;
    } else if (startStep && steps0.some(s => s.id === startStep && s.navigable)) return startStep;
    return firstGap(steps0);
  });
  const steps = useMemo(() => buildSteps(draft, ctx, step), [draft, ctx, step]);
  const dates = useMemo(() => caseDates(draft, ctx), [draft, ctx]);
  const notes = useMemo(() => notesFor(draft, ctx, dates), [draft, ctx, dates]);
  const gaps = gapCount(draft, ctx);

  const [drawer, setDrawer] = useState<DrawerState | null>(null);
  const [pickingPatient, setPickingPatient] = useState(false);
  const [confirmDelete, setConfirmDelete] = useState(false);
  const [nhsConfirm, setNhsConfirm] = useState<ReturnType<typeof nhsConflicts> | null>(null);
  const [banner, setBanner] = useState<string | null>(null);
  const [saveState, setSaveState] = useState<'saved' | 'saving' | 'unsaved'>(initial.id ? 'saved' : 'unsaved');
  const [sending, setSending] = useState(false);
  const [sent, setSent] = useState<{ result: SentResult; snap: Snapshot; ids: string[] } | null>(null);
  const [undoOpen, setUndoOpen] = useState(false);
  const sendingRef = useRef(false);
  const headingRef = useRef<HTMLHeadingElement>(null);

  // Refs so timers read the latest values.
  const stepsRef = useRef(steps); stepsRef.current = steps;
  const stepRef = useRef(step); stepRef.current = step;
  const manualAdvance = useRef(false);
  const pending = useRef<{ kind: 'item'; id: string } | { kind: 'nextFrom'; id: string } | null>(null);

  const go = useCallback((id: string) => { setStep(id); setDrawer(null); }, []);

  // Focus the step heading whenever the step changes.
  useEffect(() => { if (!sent) headingRef.current?.focus(); }, [step, sent]);

  // A step that no longer exists (item removed) falls back to the first gap.
  useEffect(() => {
    if (!steps.some(s => s.id === step)) setStep(firstGap(steps));
  }, [steps, step]);

  // Pending navigation after a structural change (new service, lab change).
  useEffect(() => {
    const p = pending.current;
    if (!p) return;
    pending.current = null;
    if (p.kind === 'item') {
      // Jump to the new service's first gap; a complete one (Repeat) moves straight on.
      const nodes = steps.filter(s => s.itemId === p.id);
      const gap = nodes.find(s => s.gap);
      setStep(gap ? gap.id : nodes.length ? nextGap(steps, nodes[nodes.length - 1].id) : firstGap(steps));
    } else {
      setStep(nextGap(steps, p.id));
    }
  }, [steps]);

  // Auto-advance: the current step was a gap and an answer resolved it.
  const cur = steps.find(s => s.id === step);
  const prevGap = useRef<{ step: string; gap: boolean } | null>(null);
  useEffect(() => {
    const was = prevGap.current;
    const isGap = !!cur?.gap;
    prevGap.current = { step, gap: isGap };
    if (manualAdvance.current) return;
    // An open case for the same item is worth a look first: "Carry On" moves on.
    const holds = notes.some(n => n.kind === 'openCase' && n.step === step);
    if (was && was.step === step && was.gap && !isGap && cur && !holds) {
      const t = setTimeout(() => setStep(nextGap(stepsRef.current, stepRef.current)), 220);
      return () => clearTimeout(t);
    }
  }, [step, cur?.gap]); // eslint-disable-line react-hooks/exhaustive-deps

  const doneAndAdvance = useCallback((fn: () => void) => {
    manualAdvance.current = true;
    fn();
    setTimeout(() => {
      setStep(nextGap(stepsRef.current, stepRef.current));
      manualAdvance.current = false;
    }, 220);
  }, []);

  // A sent case, or one waiting for approval, is read-only until Change Something:
  // answers can't change underneath it, whatever control a step still shows.
  const locked = useRef(readOnly);
  locked.current = readOnly;
  const update = useCallback((fn: (d: CaseDraft) => CaseDraft) => { if (!locked.current) setDraft(d => fn(d)); }, []);
  const updateItem = useCallback((id: string, patch: Partial<ServiceItem> | ((i: ServiceItem) => ServiceItem)) => {
    if (locked.current) return;
    setDraft(d => ({ ...d, items: d.items.map(i => (i.id === id ? (typeof patch === 'function' ? patch(i) : { ...i, ...patch }) : i)) }));
  }, []);

  // ── Saving ────────────────────────────────────────────────────────────────
  const persist = useCallback((d: CaseDraft) => {
    if (!d.id) return;
    const existing = getRow(d.id);
    saveRow({
      ...(existing ?? { source: 'clinic' as const, createdBy: user.id }),
      id: d.id,
      patientId: d.patientId,
      status: 'Draft',
      flag: existing?.flag === 'Awaiting approval' ? existing.flag : undefined,
      draft: d,
      service: serviceSummary(d, user),
      dentist: buildCtx(d, user)?.prescriber?.name,
      labId: d.lab,
      updatedAt: Date.now(),
    });
  }, [user]);

  // A new case is saved (gets an ID and a Draft row) at its first service or note.
  useEffect(() => {
    if (readOnly || draft.id) return;
    if (draft.items.length === 0 && !draft.note.trim() && !draft.instructions?.trim()) return;
    const id = nextCaseId();
    setDraft(d => ({ ...d, id }));
    navigate(`/flows/new-case/case/${id}`, { replace: true, state: { session: sessionKey } });
  }, [draft.items.length, draft.note, draft.id, readOnly, navigate, sessionKey]);

  // Autosave.
  useEffect(() => {
    if (readOnly || !draft.id || sent) return;
    setSaveState('saving');
    const t = setTimeout(() => { persist(draft); setSaveState('saved'); }, 400);
    return () => clearTimeout(t);
  }, [draft, readOnly, persist, sent]);

  // Re-validate the fit whenever Back by can move later.
  useEffect(() => {
    if (!draft.fit || !dates.backBy || readOnly) return;
    if (!fitCheck(draft.fit, dates.backBy).ok) {
      setDraft(d => ({ ...d, fit: undefined }));
      toast.warning('That fit date is now too soon for the lab. Pick a new one.');
    }
  }, [dates.backBy?.getTime(), draft.fit]); // eslint-disable-line react-hooks/exhaustive-deps

  // Dropping a file outside a drop zone must not navigate away.
  useEffect(() => {
    const stop = (e: DragEvent) => e.preventDefault();
    window.addEventListener('dragover', stop);
    window.addEventListener('drop', stop);
    return () => { window.removeEventListener('dragover', stop); window.removeEventListener('drop', stop); };
  }, []);

  // ── Actions ───────────────────────────────────────────────────────────────
  const addService = useCallback((product: ProductId, extra: Partial<ServiceItem> = {}) => {
    const item = newItem(product, extra);
    pending.current = { kind: 'item', id: item.id };
    setDraft(d => ({ ...d, items: [...d.items, item], keepTogether: false }));
  }, []);
  const removeItem = useCallback((id: string) => {
    setDraft(d => ({ ...d, items: d.items.filter(i => i.id !== id), split: false }));
    // The Remove button unmounts with its card; keep focus on the step heading, not <body>.
    setTimeout(() => { if (document.activeElement === document.body) headingRef.current?.focus({ preventScroll: true }); }, 0);
  }, []);
  const changeLab = useCallback((labId: LabId) => {
    const nl = labById(labId);
    if (draft.items.some(i => !labMakes(nl, i.product))) return;
    // Picking the lab answers the Lab gap, so auto-advance moves on by itself;
    // a later change of lab moves on explicitly.
    const wasGap = draft.labPicked === false;
    if (labId === draft.lab) {
      if (wasGap) setDraft(d => ({ ...d, labPicked: true }));
      else setStep(nextGap(stepsRef.current, 'lab'));
      return;
    }
    if (!wasGap) pending.current = { kind: 'nextFrom', id: 'lab' };
    setDraft(d => ({
      ...d, lab: labId, labSrc: 'You', labPicked: true, fastTrack: d.fastTrack && !!nl.fastTrack, split: false,
      items: d.items.map(i => {
        const n = { ...i };
        if (i.material && !optionAvail(nl, i.product, i.material, d.funding, i).ok) { n.material = undefined; n.matSrc = undefined; }
        if (i.type && !optionAvail(nl, i.product, i.type, d.funding).ok) { n.type = undefined; n.typeSrc = undefined; }
        if (i.product === 'denture' && i.stage && !optionAvail(nl, 'denture', i.stage, d.funding).ok) n.stage = undefined;
        if (i.base && !optionAvail(nl, 'partial', i.base, d.funding).ok) n.base = undefined;
        if (i.work && !optionAvail(nl, 'reline', i.work, d.funding).ok) n.work = undefined;
        return n;
      }),
    }));
    toast.success(`${nl.name} is making this case.`);
  }, [draft.items, draft.lab, toast]);

  const applyNhs = (conflicts: ReturnType<typeof nhsConflicts>) => {
    setDraft(d => reopenFor({ ...d, funding: 'nhs' }, conflicts));
    if (conflicts.length) setBanner(`Reopened: ${conflicts.map(c => `${itemPhrase(c.item, user.notation)} (${c.slot})`).join(', ')}.`);
  };
  const setFunding = useCallback((f: Funding) => {
    if (f === draft.funding) return;
    if (f === 'private') { setDraft(d => ({ ...d, funding: 'private' })); return; }
    const conflicts = nhsConflicts(draft, ctx);
    if (conflicts.length) setNhsConfirm(conflicts);
    else setDraft(d => ({ ...d, funding: 'nhs' }));
  }, [draft, ctx]);

  const switchToImplant = useCallback((itemId: string) => {
    const item = draft.items.find(i => i.id === itemId);
    const rec = item && patient.implants?.find(x => item.teeth.includes(x.tooth));
    if (!item || !rec) return;
    const implant = newItem('implant', { teeth: [rec.tooth], teethDone: true, teethSrc: 'Patient record' });
    pending.current = { kind: 'item', id: implant.id };
    setDraft(d => ({
      ...d,
      items: d.items.flatMap(i => {
        if (i.id !== itemId) return [i];
        const rest = i.teeth.filter(t => t !== rec.tooth);
        return rest.length ? [{ ...i, teeth: rest }, implant] : [implant];
      }),
    }));
  }, [draft.items, patient.implants]);

  const changePatient = (pid: string) => {
    setPickingPatient(false);
    const np = getPatient(pid);
    if (!np || pid === draft.patientId) return;
    const old = patient;
    let d: CaseDraft = { ...draft, patientId: pid, funding: np.funding, dismissedNotes: [], items: draft.items.map(resetChecks) };
    const msgs: string[] = [];
    if (d.scan && d.scan.patientId !== pid) {
      msgs.push(`The ${d.scan.scanner} scan belongs to ${old.first} ${old.last}, so it’s been removed from this case.`);
      d = { ...d, scan: undefined, login: undefined, id: undefined, records: { box: {}, disinfected: false, files: [] } };
    }
    // Teeth recorded as missing for the new patient can't keep a crown, veneer or inlay.
    const missing = np.missing ?? [];
    const dropped = d.items.filter(i => ['crown', 'veneer', 'inlay'].includes(i.product) && i.teeth.some(t => missing.includes(t)));
    if (dropped.length) {
      d = { ...d, items: d.items.map(i => (dropped.includes(i) ? { ...i, teeth: i.teeth.filter(t => !missing.includes(t)), teethDone: false } : i)) };
      msgs.push(`${np.first} has ${missing.join(', ')} recorded as missing: reopened ${dropped.map(i => `${PRODUCTS[i.product].noun} (teeth)`).join(', ')}.`);
    }
    if (np.funding === 'nhs') {
      const conflicts = nhsConflicts(d, { ...ctx, patient: np });
      d = reopenFor(d, conflicts);
      if (conflicts.length) msgs.push(`Reopened: ${conflicts.map(c => `${itemPhrase(c.item, user.notation)} (${c.slot})`).join(', ')}.`);
    }
    // No lab picked yet: suggest the new patient's (the lab that made their previous stage, else the usual).
    if (d.labPicked === false) {
      d = { ...d, lab: np.nextStage?.lab ?? CLINIC.usualLab, labSrc: np.nextStage ? 'Made the previous stage' : "Clinic's usual lab" };
    }
    // After picking the patient, move on to the next gap (the lab, on a new case).
    pending.current = { kind: 'nextFrom', id: 'patient' };
    setDraft(d);
    setBanner(msgs.join(' ') || null);
    if (!d.id) {
      setSaveState('unsaved');
      navigate(`/flows/new-case/case/new?patient=${encodeURIComponent(pid)}`, { replace: true, state: { session: sessionKey } });
    }
    toast.info(`Case moved to ${np.first} ${np.last}.`);
  };

  const sendSeparately = useCallback((on: boolean) => setDraft(d => ({ ...d, split: on, keepTogether: !on })), []);

  const ensureId = (d: CaseDraft): CaseDraft => (d.id ? d : { ...d, id: nextCaseId() });
  const saveAndClose = (withToast: boolean) => {
    if (readOnly) { navigate('/flows/new-case/cases'); return; }
    if (withToast) {
      const d = ensureId(draft);
      if (d.login && d.rememberLogin && d.prescriber && !loginMap()[d.login]) learnLogin(d.login, d.prescriber);
      persist(d);
      toast.success('Saved as a draft. It’s in Cases.');
    } else if (draft.id) {
      persist(draft);
    }
    navigate('/flows/new-case/cases');
  };

  // ── Send ──────────────────────────────────────────────────────────────────
  const send = async (approving = false) => {
    if (sendingRef.current) return;
    if (gaps > 0) { go(firstGap(steps)); return; }
    sendingRef.current = true;
    setSending(true);
    await new Promise(r => setTimeout(r, 650));
    const mode = sendMode(user, prescriber);
    const follow = recordsState(draft, ctx) === 'follow';
    const posted = isPosted(recordsState(draft, ctx));
    const d0 = ensureId(draft);
    const split = d0.split ? splitSuggestion(d0, ctx, dates) : null;
    const groups = split ? [[split.item], d0.items.filter(i => i.id !== split.item.id)] : [d0.items];
    // Approving reuses the IDs made when it was sent for approval: no duplicate orders.
    const ids = d0.groupIds && d0.groupIds.length === groups.length ? d0.groupIds : groups.map((_, k) => (k === 0 ? d0.id! : nextCaseId()));
    if (d0.login && d0.rememberLogin && prescriber && !loginMap()[d0.login]) learnLogin(d0.login, prescriber.id);
    const snap = snapshot(ids);
    const now = Date.now();
    const existing = getRow(d0.id!);
    const toApprove = mode === 'approval';
    const rows: CaseRow[] = groups.map((items, k) => {
      const gd: CaseDraft = { ...d0, id: ids[k], items, split: false, groupIds: ids, preparedBy: toApprove ? user.id : d0.preparedBy };
      const gdates = caseDates(gd, ctx);
      return {
        id: ids[k], patientId: d0.patientId,
        status: toApprove ? 'Draft' : posted ? 'Ready for Dispatch' : 'Received',
        flag: toApprove ? 'Awaiting approval' : follow ? 'Awaiting scan' : undefined,
        source: existing?.source ?? 'clinic', createdBy: existing?.createdBy ?? user.id, scanLabel: existing?.scanLabel,
        draft: gd, service: serviceSummary(gd, user), delivery: gdates.backBy ? toISO(gdates.backBy) : undefined,
        dentist: prescriber?.name, labId: d0.lab, updatedAt: now, sentAt: toApprove ? undefined : now,
      };
    });
    saveRows(rows);
    if (approving || (d0.preparedBy && !toApprove)) {
      const prep = userById(d0.preparedBy);
      if (prep) addEvent({ forUser: prep.id, caseId: ids[0], text: `${user.short} approved and sent ${patient.first} ${patient.last}’s case.` });
    }
    // The next scanner draft waiting, for "Next scan waiting".
    const next = store.rows.find(r => r.status === 'Draft' && r.source === 'scanner' && !r.flag && r.draft && !ids.includes(r.id));
    const nextP = next && getPatient(next.patientId);
    const nextCtx = next && buildCtx(next.draft!, user);
    const box = { ...defaultBox(d0), ...d0.records.box };
    const result: SentResult = {
      heading: toApprove ? `Sent to ${prescriber!.short} to Approve` : follow ? 'Sent. Waiting for the Scan' : posted ? `Ready for Dispatch to ${lab.name}` : groups.length > 1 ? `${groups.length} Cases Created for ${lab.name}` : `Case Created for ${lab.name}`,
      approval: toApprove,
      posted,
      lab,
      patient,
      box: posted ? Object.keys(box).filter(k => box[k]) : undefined,
      disinfected: posted && d0.records.disinfectedAt ? `Disinfected with ImpressSafe by ${d0.records.disinfectedBy}, ${d0.records.disinfectedAt}` : undefined,
      cases: rows.map(r => {
        const gd = r.draft!;
        const gdates = caseDates(gd, ctx);
        return {
          id: r.id,
          summary: gd.items.map(i => itemTitle(i, user.notation)).join(' + '),
          backBy: follow && gdates.ta != null ? `Back ${plural(gdates.ta, 'working day')} after the scan arrives.` : gdates.backBy ? `Back by ${fmtDay(gdates.backBy)}.` : undefined,
          fitFrom: !follow && !gd.fit && gdates.earliestFit ? fmtDay(gdates.earliestFit) : undefined,
          fit: !follow && gd.fit ? fmtDay(fromISO(gd.fit)) : undefined,
        };
      }),
      next: next && nextP ? { id: next.id, text: `${nextP.first} ${nextP.last} · ${next.scanLabel ?? ''} · ${(() => { const g = nextCtx ? gapCount(next.draft!, nextCtx.ctx) : 0; return g ? `▲ ${plural(g, 'thing')} left` : '✓ Ready to send'; })()}` } : undefined,
    };
    setDraft(d0);
    setSent({ result, snap, ids });
    setUndoOpen(!toApprove);
    setSaveState('saved');
    sendingRef.current = false;
    setSending(false);
    if (d0.items.some(i => i.saveUsual)) toast.success('Preferences saved as your usual.');
  };

  const undo = () => {
    if (!sent) return;
    restore(sent.snap);
    setSent(null);
    setUndoOpen(false);
    setView('edit');
    toast.info('Back to a draft. Nothing reached the lab.');
  };

  // ── Keyboard ──────────────────────────────────────────────────────────────
  const keyRef = useRef<(e: KeyboardEvent) => void>();
  keyRef.current = (e: KeyboardEvent) => {
    if ((e.ctrlKey || e.metaKey) && e.key === 'Enter') {
      e.preventDefault();
      if (sent) return;
      if (view === 'approve') { send(true); return; }
      if (readOnly) return;
      if (gaps > 0) go(firstGap(steps)); else send();
      return;
    }
    if (e.key === 'Escape') {
      if (drawer) { setDrawer(null); return; }
      if (pickingPatient || nhsConfirm || confirmDelete) { setPickingPatient(false); setNhsConfirm(null); setConfirmDelete(false); return; }
      if (sent) return;
      saveAndClose(false);
    }
  };
  useEffect(() => {
    const h = (e: KeyboardEvent) => keyRef.current?.(e);
    window.addEventListener('keydown', h);
    return () => window.removeEventListener('keydown', h);
  }, []);

  // One persistent polite live region for the gap count.
  const [announce, setAnnounce] = useState('');
  useEffect(() => { if (!readOnly) setAnnounce(gaps ? `${plural(gaps, 'thing')} left` : 'Ready to send'); }, [gaps, readOnly]);

  const api: CaseApi = {
    draft, update, updateItem, ctx, user, patient, lab, prescriber, prescriberSrc: derived!.prescriberSrc,
    steps, step, go, doneAndAdvance, dates, notes,
    dismissNote: id => setDraft(d => ({ ...d, dismissedNotes: [...d.dismissedNotes, id] })),
    gaps, readOnly, openDrawer: setDrawer, addService, removeItem, changeLab, setFunding,
    openLauncher: () => { setPickingPatient(true); go('patient'); },
    pickingPatient, closePatientPicker: () => setPickingPatient(false), changePatient,
    switchToImplant, sendSeparately, toast,
  };

  // ── Header line and the controller every layout reads ────────────────────
  const navSteps = steps.filter(s => s.navigable);
  const stepIndex = Math.max(0, navSteps.findIndex(s => s.id === step)) + 1;
  const parsed = parseStep(step);
  const curItem = parsed.itemId ? draft.items.find(i => i.id === parsed.itemId) : undefined;
  const stepTitle = (() => {
    if (parsed.kind === 'slot' && curItem && cur?.slot) return `${cur.slot.label} · ${PRODUCTS[curItem.product].label}`;
    return { patient: 'Patient', lab: 'Lab Selection', services: 'Services', records: 'Scans Source', prescriber: 'Prescriber', delivery: 'Delivery', review: 'Review and Send', slot: '' }[parsed.kind];
  })();
  const sub = [
    initialRow?.source === 'scanner' && draft.scan ? `New case · from ${draft.scan.scanner} scan, today ${draft.scan.time}` : readOnly ? 'Case' : 'New case',
    `${patient.first} ${patient.last}`,
  ].join(' · ');
  const row = draft.id ? store.rows.find(r => r.id === draft.id) : undefined;
  const preparedBy = userById(draft.preparedBy);

  const controller: CaseController = {
    ux: store.ux,
    view,
    changeSomething: () => { setView('edit'); setStep(firstGap(steps)); },
    headingRef,
    saveState,
    sending,
    send: approving => { void send(approving); },
    sendLabel: sendLabel(sendMode(user, prescriber), prescriber, draft.split, isPosted(recordsState(draft, ctx))),
    saveAndClose,
    requestDelete: () => setConfirmDelete(true),
    showHelp: () => toast.info('Ctrl + Enter sends (or jumps to the next gap). Esc closes a drawer, else saves and closes.'),
    banner,
    dismissBanner: () => setBanner(null),
    startSeparate: () => navigate(`/flows/new-case/case/new?patient=${draft.patientId}`, { state: { session: `sep-${Date.now()}` } }),
    row,
    preparedBy,
    preparedAt: row ? fmtTime(demoTimeOf(row.updatedAt)) : undefined,
    stepIndex,
    stepTotal: navSteps.length,
    stepTitle,
    sub,
    firstGapId: firstGap(steps),
    nextGapId: nextGap(steps, step),
  };

  const Layout = store.ux === 'chat' ? ConversationLayout : store.ux === 'canvas' ? CanvasLayout : GuidedLayout;

  return (
    <CaseContext.Provider value={api}>
      <ControllerContext.Provider value={controller}>
        {sent ? (
          <>
            <SentView
              result={sent.result}
              onBack={() => navigate('/flows/new-case/cases', { state: { highlight: sent.ids } })}
              onView={id => navigate(`/flows/new-case/case/${id}`, { state: { session: `view-${id}-${Date.now()}` } })}
              onNext={id => navigate(`/flows/new-case/case/${id}`, { state: { session: `next-${id}-${Date.now()}` } })}
            />
            {undoOpen && <UndoToast onUndo={undo} onExpire={() => setUndoOpen(false)} />}
          </>
        ) : (
          <Layout />
        )}

        <Drawers drawer={drawer} onClose={() => setDrawer(null)} />
        {nhsConfirm && (
          <ConfirmModal
            title="Switch to NHS?"
            body={nhsConfirm.map(c => `${c.name} isn’t available on the NHS. The ${itemPhrase(c.item, user.notation)} will need a new ${c.slot === 'base' ? 'base' : c.slot === 'type' ? 'type' : c.slot}.`).join(' ')}
            cancel="Keep Private"
            confirm="Switch to NHS"
            onCancel={() => setNhsConfirm(null)}
            onConfirm={() => { applyNhs(nhsConfirm); setNhsConfirm(null); }}
          />
        )}
        {confirmDelete && (
          <ConfirmModal
            title="Delete This Draft?"
            body={draft.scan ? `The scan stays on ${patient.first}’s patient record.` : 'This draft and its answers will be removed.'}
            cancel="Keep It"
            confirm="Delete Draft"
            danger
            onCancel={() => setConfirmDelete(false)}
            onConfirm={() => { if (draft.id) removeRow(draft.id); setConfirmDelete(false); toast.success('Draft deleted.'); navigate('/flows/new-case/cases'); }}
          />
        )}
        <div className="sr-only" aria-live="polite">{announce}</div>
      </ControllerContext.Provider>
    </CaseContext.Provider>
  );
}

function ConfirmModal({ title, body, cancel, confirm, onCancel, onConfirm, danger }: {
  title: string; body: string; cancel: string; confirm: string; onCancel: () => void; onConfirm: () => void; danger?: boolean;
}) {
  const ref = useRef<HTMLButtonElement>(null);
  useEffect(() => { ref.current?.focus(); }, []);
  return (
    <ModalPortal>
      <div className="fixed inset-0 z-[120] flex items-center justify-center">
        <div className="absolute inset-0 bg-black/40" onClick={onCancel} />
        <div role="alertdialog" aria-modal="true" aria-labelledby="cm-title" aria-describedby="cm-body" className="relative w-[440px] bg-white rounded-2xl shadow-2xl p-6">
          <h2 id="cm-title" className="text-lg font-semibold text-[#030213]">{title}</h2>
          <p id="cm-body" className="text-sm text-[#3A3A4A] mt-2 leading-relaxed">{body}</p>
          <div className="mt-6 flex justify-end gap-2">
            <SecondaryButton onClick={onCancel}>{cancel}</SecondaryButton>
            <button ref={ref} type="button" onClick={onConfirm} className={`px-4 py-2 rounded-lg text-sm font-semibold text-white ${danger ? 'bg-[#B91C1C] hover:bg-[#991B1B]' : 'bg-gradient-to-r from-[#3F6FE8] to-[#6A5CE8]'} ${FOCUS}`}>{confirm}</button>
          </div>
        </div>
      </div>
    </ModalPortal>
  );
}
