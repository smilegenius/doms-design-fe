// ─── New Case Flow · View Case ───────────────────────────────────────────────
// A finished case opens in the portal's own Case Details (pages/CaseDetailPage),
// the screen every clinic case opens in: tabs, the Ready for Dispatch panel
// (Print label, Mark as dispatched), the Shipping tab and Mark as Received. The
// flow row (and its draft, when it has one) is mapped the way Quick Create maps
// a submission (QuickCreateCasePage buildCaseRecord); status changes made there
// are written back to the flow's store, so the real Cases list is never touched.
// Drafts, including ones waiting for approval, stay in the flow's own editor.

import { useEffect, useMemo, useRef, useState } from 'react';
import { Navigate, useNavigate, useParams } from 'react-router-dom';
import CaseDetailPage, { OrderFormSlot, type CaseForDetail, type OrderFormHost, type ServiceItem as PortalItem } from '../pages/CaseDetailPage';
import { getDispatchRecord, removeDispatch, useDispatchRecord, type DispatchRecord } from '../data/dispatchRecords';
import { useScannerConnections } from '../data/scannerConnections';
import { statusReach } from '../data/caseProvenance';
import { formatCaseDate } from '../data/rescanDetection';
import { caseDateToISO, isoToCaseDate } from '../data/dentureStages';
import { useToast } from '../context/ToastContext';
import FlowFrame from './FlowFrame';
import OrderFormSheet, { OrderFormFullView, type OrderFormModel, type StageStatus } from './OrderForm';
import { CLINIC, Funding, Patient, PriorWork, ProductId, USERS, User, labById, userById } from './data';
import { DEMO_NOW, demoNow, demoTimeOf, fmtFull, fromISO, lastWorkingDayBefore, toISO } from './dates';
import {
  Ctx, DENTURE_STAGES, Effective, FileRole, PARTIAL_STAGES, ServiceItem, archTeethIds, archWord, bridgeParts, caseDates,
  caseInstructions, dentureTreatment, effective, isPosted, isStageId, itemFunding, itemTitle, optionName, patientAge,
  recordsState, shadeText, spanText, stageName, stagePlan, teethText, treatmentName,
} from './rules';
import { CaseRow, RowStatus, getPatient, getRow, markDispatched, newItem, saveRow, useFlowStore } from './store';
import { sentCtx } from './derive';
import { postedBackBy, useShipped } from './dispatch';

type PortalStatus = CaseForDetail['status'];

/** Flow → portal status. Received (the lab has it, digitally) has no portal twin: the portal calls that Submitted. */
const TO_PORTAL: Record<RowStatus, PortalStatus> = {
  Draft: 'draft',
  'Ready for Dispatch': 'ready-for-dispatch',
  Submitted: 'submitted',
  Received: 'submitted',
  'In production': 'in-production',
  Delivered: 'delivered',
};
/** Portal → flow, where the flow has the status; any other is left on the portal page only. */
const FROM_PORTAL: Partial<Record<PortalStatus, RowStatus>> = {
  'ready-for-dispatch': 'Ready for Dispatch',
  submitted: 'Submitted',
  'in-production': 'In production',
  delivered: 'Delivered',
};
/** How far along a row is (Received is the lab having it, as Submitted is). */
const RANK: Record<RowStatus, number> = { Draft: 0, 'Ready for Dispatch': 1, Submitted: 2, Received: 2, 'In production': 3, Delivered: 4 };
const SEX: Record<Patient['sex'], string> = { F: 'Female', M: 'Male', X: 'Not stated' };

/** The portal's service names (Quick Create's catalogue), so its icons, denture stage tabs and scoring know them. */
const PORTAL_SERVICE: Record<ProductId, string> = {
  crown: 'Crown', bridge: 'Bridge', implant: 'Implant Crown', veneer: 'Veneers', inlay: 'Inlay or Onlay',
  nightguard: 'Night Guard', denture: 'Full Denture', partial: 'Partial Denture', reline: 'Reline or Repair',
  retainer: 'Retainer', aligner: 'Clear Aligners', whitening: 'Whitening Trays', other: 'Something Else',
};
/** A partial's one stage under the portal's stage names where they match (Framework Try-In keeps its own). */
const PARTIAL_TO_PORTAL: Record<string, string> = { tray: 'Special Tray', blocks: 'Bite Registration', tryin: 'Try In', finish: 'Finish' };

/** Seed rows sit on the demo calendar already; anything this session wrote is a real timestamp, put on the demo clock. */
const onDemoClock = (row: CaseRow, ms: number) => (row.draft || ms > DEMO_NOW.getTime() ? demoTimeOf(ms) : new Date(ms));
const caseDate = (iso?: string) => (iso ? isoToCaseDate(iso) : null);

/** "Monolithic zirconia", "Hard (Michigan)", "Cobalt-chrome": what the portal's Material field holds for each service. */
function materialOf(item: ServiceItem, e?: Effective): string | undefined {
  const mat = e?.material ?? item.material;
  const type = e?.type ?? item.type;
  switch (item.product) {
    case 'crown': case 'bridge': case 'veneer': case 'implant':
      return mat ? optionName(item.product, mat) : undefined;
    case 'inlay': {
      const kind = item.inlayType === 'onlay' ? 'Onlay' : item.inlayType === 'inlay' ? 'Inlay' : undefined;
      return mat ? [kind, optionName('inlay', mat)].filter(Boolean).join(' · ') : undefined;
    }
    case 'nightguard': case 'retainer':
      return type ? optionName(item.product, type) : undefined;
    case 'denture':
      return e?.acrylic ? `Acrylic · ${e.acrylic}` : undefined;
    case 'partial':
      return item.base ? optionName('partial', item.base) : undefined;
    case 'reline':
      return item.work ? optionName('reline', item.work) : undefined;
    default:
      return undefined;
  }
}

/**
 * One flow service as one portal service item. Teeth go as FDI numbers (the portal's chart and Tooth/Arch
 * field read those); an arch item covers its whole jaw, as the portal's dentures do. A full denture has no
 * date of its own, only its stages; a partial's one stage carries the partial's back-by day.
 */
function portalItem(item: ServiceItem, k: number, o: {
  caseId: string; status: PortalStatus; funding: Funding; ctx?: Ctx; backBy?: string;
  instructions: string; scanFileCount: number;
}): PortalItem {
  const e = o.ctx ? effective(item, o.ctx) : undefined;
  const teeth = item.teeth.length ? item.teeth : item.arch ? archTeethIds(item.arch) : [];
  const base: PortalItem = {
    id: `${o.caseId}-s${k + 1}`,
    name: PORTAL_SERVICE[item.product],
    status: o.status,
    deliveryDate: caseDate(o.backBy),
    fdi: teeth.map(Number),
    material: materialOf(item, e),
    shade: shadeText(item) || undefined,
    orderType: itemFunding(item.product, o.funding) === 'nhs' ? 'NHS' : 'Private',
    // As Quick Create: every service carries the case instructions (here with each service's own note under its title).
    instructions: [item.product === 'other' ? item.desc?.trim() : '', o.instructions].filter(Boolean).join('\n\n') || undefined,
    scanFileCount: o.scanFileCount,
    attachmentCount: item.photos.length,
  };
  if (item.product === 'denture') {
    // Stages done here belong to the earlier case; the rest are this case's stage order.
    const plan = stagePlan(item).filter(s => s.state !== 'here');
    const names = plan.map(s => stageName(s.id));
    return {
      ...base,
      name: dentureTreatment(item) === 'immediate' ? 'Immediate Denture' : base.name,
      deliveryDate: null,
      stages: names,
      stageDates: Object.fromEntries(plan.map(s => [stageName(s.id), caseDate(s.date)])),
      doneElsewhere: plan.filter(s => s.state === 'elsewhere').map(s => stageName(s.id)),
    };
  }
  if (item.product === 'partial' && item.stage) {
    const st = PARTIAL_TO_PORTAL[item.stage] ?? PARTIAL_STAGES.find(s => s.id === item.stage)?.name ?? item.stage;
    return { ...base, deliveryDate: null, stages: [st], stageDates: { [st]: caseDate(o.backBy) } };
  }
  // Clear Aligners: Phasing drives the portal's Phase 1 / Phase 2 tabs (left unset, the portal's own default).
  if (item.product === 'aligner') {
    const ph = item.aligner?.phasing;
    return { ...base, phasing: ph === 'Yes' ? true : ph === 'No' ? false : undefined };
  }
  return base;
}

/**
 * A history row (made before this flow) has no draft: its service comes from the patient's record of
 * that case (product, teeth or arch, option, shade). Without one it shows the list line as it is.
 */
function historyItem(row: CaseRow): ServiceItem | undefined {
  const w = getPatient(row.patientId)?.history?.find(h => h.caseId === row.id);
  if (!w) return undefined;
  const item = newItem(w.product, { id: `${row.id}-h`, teeth: w.teeth ?? [], teethDone: true, arch: w.arch, shade: w.shade });
  if (['crown', 'bridge', 'veneer', 'inlay', 'implant'].includes(w.product)) item.material = w.option;
  if (w.product === 'nightguard' || w.product === 'retainer') item.type = w.option;
  if (w.product === 'partial') item.base = w.option;
  if (w.product === 'reline') item.work = w.option;
  if (w.product === 'denture' && isStageId(w.option)) item.stages = [{ id: w.option, state: 'order', date: row.delivery ?? w.date }];
  return item;
}

/**
 * When a history case was made. An open one's record date is the day it was sent; a delivered one's is the
 * day it came back, so it was made its turnaround earlier (the lab's price list, else 10 working days). Its
 * denture stage keeps the delivered day, so it stays this case's own stage, never "done earlier".
 */
function historyCreated(w: PriorWork): Date {
  const day = fromISO(w.date);
  if (w.open) return day;
  const ta = labById(w.lab).prices[`${w.product}:${w.option}`]?.[2] ?? 10;
  let made = day;
  for (let k = 0; k < ta; k++) made = lastWorkingDayBefore(made);
  return made;
}

/** The flow row as the portal's case record. `shipped`: once posted, each service's date counts from the post day. */
export function toCaseForDetail(row: CaseRow, user: User, shipped?: DispatchRecord): CaseForDetail {
  const p = getPatient(row.patientId);
  const lab = labById(row.labId);
  const n = user.notation;
  const status = TO_PORTAL[row.status];
  const draft = row.draft;
  // Counted for the case's own maker, not whoever is signed in to the demo.
  const built = sentCtx(row, user);
  // When it was sent, on the demo clock: kept at send, else (a row sent before that was kept) its send
  // timestamp put on the clock, which moves with each page load.
  const sentMoment = row.sentDemoAt ? new Date(row.sentDemoAt) : row.sentAt ? demoTimeOf(row.sentAt) : undefined;
  // The day its dates count from: the post day once posted, today while it waits to be posted ("dates if
  // posted today"), else when the lab got it (sent, or its scan attached), so they don't drift with the clock.
  const from = shipped ? fromISO(shipped.dispatchedOn)
    : row.status === 'Ready for Dispatch' ? undefined
    : row.scanAt ? new Date(row.scanAt) : sentMoment;
  const ctx = built ? (from ? { ...built.ctx, now: from } : built.ctx) : undefined;

  let serviceItems: PortalItem[];
  let source: CaseForDetail['source'];
  let scanner: string | undefined;
  let receivedVia: string | undefined;
  if (draft && ctx) {
    const rs = recordsState(draft, ctx);
    // Impressions by post (dentures always go by post) read as Sent via Post; a scan as its scanner. A scan still
    // to follow isn't from a scanner yet (no brand, no scanner link): the label says what it's waiting for.
    source = isPosted(rs) ? 'post' : rs === 'scan' ? 'scanner' : rs === 'email' ? 'email' : 'manual';
    scanner = draft.scan?.scanner;
    if (rs === 'post' && draft.records.courier) receivedVia = `Sent via Post · ${draft.records.courier}`;
    if (rs === 'sms' || rs === 'whatsapp' || rs === 'other') receivedVia = rs === 'sms' ? 'SMS' : rs === 'whatsapp' ? 'Whatsapp' : 'Other';
    if (rs === 'upload' && draft.records.scannerBrand) scanner = draft.records.scannerBrand;
    if (rs === 'follow') receivedVia = row.scanArrived ? `Scan to follow · ${row.scanArrived.scanner} scan in, not attached yet` : 'Scan to follow · waiting for the scan';
    const arches = draft.scan ? Object.values(draft.scan.arches).filter(Boolean).length : 0;
    const scanFileCount = rs === 'scan' ? arches : rs === 'upload' ? draft.records.files.length : 0;
    const perItem = caseDates(draft, ctx).perItem;
    const single = draft.items.length === 1;
    const instructions = caseInstructions(draft, n);
    serviceItems = draft.items.map((it, k) => {
      const own = perItem.find(x => x.id === it.id)?.backBy;
      // One service: the row's back-by day (what Lab Work shows). Several: each its own.
      const backBy = single ? row.delivery ?? (own && toISO(own)) : own ? toISO(own) : row.delivery;
      return portalItem(it, k, { caseId: row.id, status, funding: draft.funding, ctx, backBy, instructions, scanFileCount });
    });
  } else {
    const hist = historyItem(row);
    source = hist && ['denture', 'partial', 'reline'].includes(hist.product) ? 'post' : 'manual';
    serviceItems = hist
      ? [portalItem(hist, 0, { caseId: row.id, status, funding: p?.funding ?? CLINIC.defaultFunding, backBy: row.delivery, instructions: '', scanFileCount: 0 })]
      : [{ id: `${row.id}-s1`, name: row.service, status, deliveryDate: caseDate(row.delivery) }];
  }
  // A history row was made before this flow: its patient record dates it (fixed), never its last save.
  const prior = draft ? undefined : p?.history?.find(h => h.caseId === row.id);
  const created = draft ? sentMoment ?? onDemoClock(row, row.updatedAt) : prior ? historyCreated(prior) : DEMO_NOW;
  // The clinic person who made it (else its prescriber).
  const maker = userById(row.createdBy)?.name ?? row.dentist ?? built?.prescriber?.name;

  return {
    id: row.id,
    patientName: p ? `${p.first} ${p.last}` : row.patientId,
    practice: CLINIC.name,
    dentist: row.dentist ?? built?.prescriber?.name ?? '—',
    lab: lab.name,
    services: serviceItems.map(si => si.name),
    serviceItems,
    status,
    createdAt: formatCaseDate(created),
    updatedAt: formatCaseDate(onDemoClock(row, row.updatedAt)),
    requestedDelivery: caseDate(row.delivery),
    hasAlert: false,
    source,
    scanner,
    receivedVia,
    createdBySide: 'clinic',
    createdBy: maker,
    creatorName: maker,
    patientAge: p ? patientAge(p, demoNow()) : undefined,
    patientGender: p ? SEX[p.sex] : undefined,
    patientRef: p ? [p.id, p.practiceId].filter(Boolean).join(' · ') : undefined,
  };
}

// ─── Order form ──────────────────────────────────────────────────────────────

const fullDate = (iso?: string) => (iso ? fmtFull(fromISO(iso)) : undefined);
/** "19/08/1955" → "19 Aug 1955" */
const dobText = (dob: string) => {
  const [d, m, y] = dob.split('/').map(Number);
  return y ? fmtFull(new Date(y, m - 1, d)) : dob;
};
const FILE_ROLE: Record<FileRole, string> = { upper: 'Upper jaw', lower: 'Lower jaw', bite: 'Bite', other: 'Other' };
const capital = (s: string) => s.charAt(0).toUpperCase() + s.slice(1);

/** What a service's prescription says beyond material and shade: funding first, then what the lab needs for it. */
function otherDetails(item: ServiceItem, funding: Funding, n: User['notation'], e?: Effective): string {
  const parts: (string | undefined)[] = [itemFunding(item.product, funding) === 'nhs' ? 'NHS' : 'Private'];
  if (item.product === 'denture') {
    parts.push(treatmentName(dentureTreatment(item)));
    if (e?.mould ?? item.mould) parts.push(`Mould: ${e?.mould ?? item.mould}`);
    if (item.postdam) parts.push(`Post-dam: ${item.postdam}`);
  }
  if (item.product === 'bridge' && item.teeth.length > 1) {
    const { pontics } = bridgeParts(item);
    parts.push(`${item.teeth.length} units${pontics.length ? ` · pontic ${teethText(pontics, n)}` : ''}`);
  }
  if (item.product === 'implant' && (e?.system ?? item.system)) parts.push([e?.system ?? item.system, e?.platform ?? item.platform].filter(Boolean).join(' '));
  if (item.product === 'aligner' && item.aligner?.alignerDuration) parts.push(item.aligner.alignerDuration);
  if (item.product === 'other' && item.desc?.trim()) parts.push(item.desc.trim());
  return parts.filter(Boolean).join(' · ');
}

/**
 * The flow case as the lab's order form. A staged full denture carries its whole history: stages made on
 * the patient's earlier case (Done, with that case's dates and instructions), stages done elsewhere, and
 * the ones this case orders (with its status), so each new stage adds a row and an instruction card.
 */
export function orderFormModel(row: CaseRow, user: User, caseData: CaseForDetail): OrderFormModel {
  const p = getPatient(row.patientId);
  const lab = labById(row.labId);
  const n = user.notation;
  const draft = row.draft;
  const ctx = sentCtx(row, user)?.ctx;
  const hist = draft ? undefined : historyItem(row);
  const items = draft ? draft.items : hist ? [hist] : [];
  const funding = draft?.funding ?? p?.funding ?? CLINIC.defaultFunding;
  // A history row's own record (its stages), and any earlier case a follow-up continues.
  const prior = p?.history?.find(h => h.caseId === row.id);
  const recordOf = (caseId?: string) => p?.history?.find(h => h.caseId === caseId);
  const created = fullDate(caseDateToISO(caseData.createdAt)) ?? caseData.createdAt;
  const status: StageStatus = row.status === 'Delivered' ? 'Done' : row.status === 'Ready for Dispatch' ? 'Ready for Dispatch' : 'In Progress';

  // How the lab got it, and the files that came with it.
  const rs = draft && ctx ? recordsState(draft, ctx) : undefined;
  const courier = draft?.records.courier ?? getDispatchRecord(row.id)?.courier;
  const posted = rs ? isPosted(rs) : caseData.source === 'post';
  let receivedVia = caseData.source === 'scanner' ? `Scanner · ${caseData.scanner ?? '—'}` : caseData.source === 'email' ? 'Email' : 'Manual upload';
  if (posted) receivedVia = `Impressions (By Post)${courier ? ` · ${courier}` : ''}`;
  else if (rs === 'upload') receivedVia = `Via Scanner${draft?.records.scannerBrand ? ` · ${draft.records.scannerBrand}` : ''}`;
  else if (caseData.receivedVia) receivedVia = caseData.receivedVia;
  let scans: OrderFormModel['scans'] = [];
  let scanNote: string | undefined;
  if (draft?.scan) {
    const ext = draft.scan.scanner === '3Shape' ? 'dcm' : 'stl';
    const a = draft.scan.arches;
    scans = [a.upper && ['Upper jaw', 'UpperJawScan'], a.lower && ['Lower jaw', 'LowerJawScan'], a.bite && ['Bite', 'BiteScan']]
      .filter((x): x is string[] => !!x)
      .map(([type, file]) => ({ type, file: `${file}.${ext}`, date: created }));
  } else if (rs === 'upload') {
    scans = draft!.records.files.map(f => ({ type: FILE_ROLE[f.role ?? 'other'], file: f.name, date: created }));
  } else if (posted) {
    scanNote = `Impressions (By Post)${courier ? ` with ${courier}` : ''}: they come in the parcel, so there are no scan files.`;
  } else if (rs === 'follow') {
    scanNote = 'Scan to follow: the scan is added here when it arrives.';
  }
  const attachments = items.flatMap(it => it.photos.map(ph => ({ file: `${ph.label.replace(/\s+/g, '_')}.jpg`, type: 'Photo', date: created })));

  // A staged full denture: every stage in order.
  const den = items.find(it => it.product === 'denture' && dentureTreatment(it) === 'staged');
  const plan = den ? stagePlan(den) : [];
  const stages: OrderFormModel['stages'] = den ? DENTURE_STAGES.map(({ id, name }, i) => {
    const row1 = { n: i + 1, name };
    // A history row: the stages made on it are its record's.
    const own = !draft ? prior?.stages?.find(s => s.id === id) : undefined;
    if (own) return { ...row1, created: fullDate(own.created), due: fullDate(own.due), status };
    const s = plan.find(x => x.id === id);
    if (!s) return row1;
    if (s.state === 'here') {
      const rec = recordOf(s.caseId)?.stages?.find(x => x.id === id);
      return { ...row1, created: fullDate(rec?.created), due: fullDate(rec?.due), status: 'Done' as const, caseId: s.caseId };
    }
    if (s.state === 'elsewhere') return { ...row1, due: fullDate(s.date), status: 'Done elsewhere' as const };
    return { ...row1, created, due: fullDate(s.date), status };
  }) : undefined;

  // Instructions: each stage made so far with what it asked for, then this case's own.
  const instructions: OrderFormModel['instructions'] = [];
  if (den && stages) {
    for (const st of stages) {
      const id = DENTURE_STAGES[st.n - 1].id;
      const note = st.caseId ? recordOf(st.caseId)?.stages?.find(x => x.id === id)?.note : !draft ? prior?.stages?.find(x => x.id === id)?.note : undefined;
      if (note) instructions.push({ n: st.n, title: st.caseId ? `${st.name} · ${st.caseId}` : st.name, text: note, status: st.status });
    }
    if (draft) {
      const ordered = stages.filter(st => st.status && st.status !== 'Done elsewhere' && !st.caseId);
      if (ordered.length) {
        instructions.push({ n: ordered[0].n, title: ordered.map(st => st.name).join(' · '), text: den.note?.trim() || 'No instructions for this stage.', status });
      }
    }
  }
  if (draft?.instructions?.trim()) {
    // Edited at Review: the case's own text, as the lab gets it.
    instructions.push({ title: 'Case Instructions', text: draft.instructions.trim(), status });
  } else {
    if (draft?.note.trim()) instructions.push({ title: 'Case Instructions', text: draft.note.trim(), status });
    items.filter(it => it !== den && it.note?.trim()).forEach(it => instructions.push({ title: itemTitle(it, n), text: it.note!.trim(), status }));
  }

  const services = items.map((it, k) => {
    const e = ctx ? effective(it, ctx) : undefined;
    const portal = caseData.serviceItems?.[k];
    const name = it.product === 'denture' ? (dentureTreatment(it) === 'immediate' ? 'Immediate denture' : 'Full denture') : PORTAL_SERVICE[it.product];
    const where = it.teeth.length ? (it.product === 'bridge' ? spanText(it.teeth, n) : teethText(it.teeth, n)) : it.arch ? capital(archWord(it.arch)) : '—';
    const delivery = it.product === 'denture' ? 'Per stage' : portal?.deliveryDate ? fullDate(caseDateToISO(portal.deliveryDate)) ?? portal.deliveryDate : '—';
    return { name, where, material: portal?.material ?? materialOf(it, e) ?? '—', shade: shadeText(it) || '—', other: otherDetails(it, funding, n, e), delivery };
  });
  const titleOf = (it: ServiceItem) => (it.product === 'denture' ? `Full denture (${archWord(it.arch)})` : itemTitle(it, n));
  const dentist = USERS.find(u => u.name === caseData.dentist);

  return {
    id: row.id,
    receivedVia,
    url: `https://app.smilegenius.co.uk/cases/${row.id}`,
    patient: { name: caseData.patientName, dob: p ? dobText(p.dob) : '—', sex: p ? SEX[p.sex] : undefined },
    dentist: { name: caseData.dentist, detail: dentist?.gdc ? `GDC ${dentist.gdc}` : undefined },
    practice: { name: CLINIC.name, address: CLINIC.address },
    lab: { name: lab.name, address: lab.address },
    caseType: items.length ? items.map(titleOf) : [row.service],
    notation: n,
    chart: {
      teeth: [...new Set(items.flatMap(it => (it.teeth.length ? it.teeth : it.arch ? archTeethIds(it.arch) : [])))],
      pontics: items.flatMap(it => (it.product === 'bridge' ? bridgeParts(it).pontics : [])),
      legend: items.map(titleOf),
    },
    stages,
    services,
    instructions,
    scans,
    scanNote,
    attachments,
  };
}

export default function FlowCaseDetail() {
  return (
    <FlowFrame>
      <DetailBody />
    </FlowFrame>
  );
}

function DetailBody() {
  const { id = '' } = useParams();
  const navigate = useNavigate();
  const { toast } = useToast();
  const store = useFlowStore();
  const user = userById(store.userId)!;
  const row = store.rows.find(r => r.id === id);
  const shipped = useShipped(row);
  const connections = useScannerConnections();
  const caseData = useMemo(() => (row && row.status !== 'Draft' ? toCaseForDetail(row, user, shipped) : null), [row, user, shipped]);
  // The order form at reading size: opened by the tab bar's full screen ('view') or Print ('print').
  const [formView, setFormView] = useState<'view' | 'print' | null>(null);

  // Case IDs come back after Reset demo: a dispatch recorded before this case was sent belongs to an
  // earlier run, and the portal page reads the record as it is, so it goes.
  const rec = useDispatchRecord(row?.id ?? '');
  useEffect(() => {
    if (row?.sentAt && rec && Date.parse(rec.at) < row.sentAt) removeDispatch(row.id);
  }, [row?.id, row?.sentAt, rec?.at]); // eslint-disable-line react-hooks/exhaustive-deps

  // The clinic can correct the dispatch on the Shipping tab: a new post day moves the back-by day too. Only a
  // post day changed while this case is open: opening it keeps a date the clinic set by hand. The portal page
  // follows the new date in place (its Delivery Date and stage dates), so the clinic stays on the Shipping tab.
  const seenPostDay = useRef({ id, day: shipped?.dispatchedOn });
  useEffect(() => {
    const was = seenPostDay.current;
    seenPostDay.current = { id, day: shipped?.dispatchedOn };
    const live = getRow(id);
    if (!live || !shipped || was.id !== id || !was.day || was.day === shipped.dispatchedOn) return;
    const delivery = postedBackBy(live, shipped.dispatchedOn, user);
    if (delivery && delivery !== live.delivery) saveRow({ ...live, delivery, updatedAt: Date.now() });
  }, [id, shipped?.dispatchedOn]); // eslint-disable-line react-hooks/exhaustive-deps

  if (!row) {
    return (
      <div className="p-10 max-w-lg">
        <h1 className="text-xl font-semibold text-[#030213] mb-2">That case isn’t in this demo</h1>
        <p className="text-sm text-[#4A4A5A]">It may have been deleted, or the demo data was reset. Go back to Lab Work to pick another.</p>
      </div>
    );
  }
  // A draft (or one waiting for approval) is still being written: the flow's editor has it.
  if (!caseData) return <Navigate to={`/flows/new-case/case/${row.id}`} replace state={{ session: `${row.id}-${Date.now()}` }} />;

  /**
   * The portal page's status changes, kept in the flow's store. Mark as dispatched has just recorded the
   * dispatch (data/dispatchRecords) before it asks for Submitted: the flow's own rule then submits the row
   * and counts its back-by day from the post day, as the flow's panel does.
   */
  const setStatus = (to: PortalStatus) => {
    const live = getRow(row.id);
    if (!live) return;
    if (live.status === 'Ready for Dispatch') {
      // Not with the lab yet: only this case's own dispatch record submits it; nothing else moves it on.
      const rec = getDispatchRecord(live.id);
      if (to === 'submitted' && rec && Date.parse(rec.at) >= (live.sentAt ?? 0)) markDispatched(live.id, postedBackBy(live, rec.dispatchedOn, user));
      return;
    }
    const next = FROM_PORTAL[to];
    // Forward only (a reply never takes a case back), and nothing past the lab having it while its scan is to follow.
    if (!next || RANK[next] <= RANK[live.status]) return;
    if (live.flag === 'Awaiting scan' && RANK[next] > RANK.Received) return;
    // Moved on: nothing the row was flagged as waiting for is still open.
    saveRow({ ...live, status: next, flag: undefined, updatedAt: Date.now() });
  };
  // The lab doesn't have it yet: not posted, or its scan is still to follow.
  const notAtLab = row.status === 'Ready for Dispatch' || row.flag === 'Awaiting scan';
  // The flow's order form, wherever the portal page shows one (service panel, Full View, Order Form modal),
  // and the Order form tab bar's full screen + Print, which open it at reading size.
  const orderForm: OrderFormHost = {
    render: ({ caseData: cd }) => <OrderFormSheet model={orderFormModel(row, user, cd)} />,
    onFullView: () => setFormView('view'),
    onPrint: () => setFormView('print'),
  };

  return (
    <OrderFormSlot.Provider value={orderForm}>
    {formView && (
      <OrderFormFullView model={orderFormModel(row, user, caseData)} autoPrint={formView === 'print'} onClose={() => setFormView(null)} />
    )}
    <CaseDetailPage
      // A new status (Mark as dispatched) starts the page afresh; a moved date doesn't (the page follows it).
      key={`${row.id}:${row.status}`}
      caseData={caseData}
      onBack={() => navigate('/flows/new-case/cases')}
      // As the clinic portal: no hand-picked status (receiving is the clinic's only way, once the lab has it), offline-lab
      // notice on, and the scanner-sync notice only where there is a scanner to sync with.
      onSetStatus={setStatus}
      canMarkReceived={!notAtLab}
      followRequestedDelivery
      onDeliveryDateChange={next => { const live = getRow(row.id); if (live) saveRow({ ...live, delivery: next ? caseDateToISO(next) : undefined, updatedAt: Date.now() }); }}
      // The flow's Lab Work has no archive view, so the portal's menu item only says so.
      onArchiveToggle={() => toast.info(`Archiving isn’t part of this demo: ${row.id} stays on Lab Work.`)}
      showOfflineLabNotice
      statusReach={caseData.source === 'scanner' ? statusReach(caseData, connections) : undefined}
      viewerPortal="clinic"
      listLabel="Lab Work"
      // The demo's clock and signed-in user, not the portal's.
      dispatchToday={toISO(demoNow())}
      currentUser={user.name}
    />
    </OrderFormSlot.Provider>
  );
}
