// ─── New Case Flow · Dental Order Form ───────────────────────────────────────
// The order form a finished flow case shows in the portal's Case Details (its
// Order form panel, Full View and the Order Form modal), through the page's
// OrderFormSlot. The portal's own form is unchanged: only the flow sets the slot.
//
// One sheet for the whole case, as the lab reads it: who it's for and from,
// where it goes back to, the teeth on one chart, a staged denture's history
// (each stage made so far, with its dates, status and instructions, so a new
// stage adds a row and an instruction card), each service's prescription and
// the instructions. An order with several cases (treatments) gives each a
// number, on the chart (a numbered line along its teeth) and wherever it
// appears: one Treatments row each (details, delivery, status), a stage
// history per staged denture, and its instructions marked with its number.
// The model is built from the flow's case in FlowCaseDetail (orderFormModel);
// this file only draws it.
//
// Laid out to print on one A4 page (5-Nov-2026): the patient and order ID head
// it on one row, the Smile Genius logo on the right; the details are two
// rows; the chart runs the full width; three QR codes (open the case, the
// how-to video, help) close the page as on the dispatch label. No file lists (the case page has
// its scans and files). A long order is scaled to fit the page. White, black
// and greys only, in a plain system font: labs aren't used to colours.

import { ReactNode, RefObject, useEffect, useId, useLayoutEffect, useRef, useState } from 'react';
import { createPortal } from 'react-dom';
import { AlertTriangle, Download, Loader2, Printer, X } from 'lucide-react';
import { useToast } from '../context/ToastContext';
import SmileGeniusWordmark from '../components/SmileGeniusWordmark';
import ModalPortal from '../components/ModalPortal';
import { FakeQr } from '../components/DispatchLabel';
import TeethChart from './TeethChart';
import { NOTATIONS, Notation } from './rules';
import {
  PAPER, SIGNATURE_FONT, fillTokens, jurisdictions, useOrderFormSettings, type OrderFormSettings, type PaperSize,
} from './orderFormSettings';

export type StageStatus = 'Done' | 'Done elsewhere' | 'In Progress' | 'Ready for Dispatch';

type StageRow = { n: number; name: string; created?: string; due?: string; status?: StageStatus; caseId?: string };
type ServiceRow = { name: string; where: string; material: string; shade: string; other: string; delivery: string };
type Card = { n?: number; title: string; text: string; status?: StageStatus };

/** One case of an order with several: its Treatments row, its stage history and its cards. */
export interface OrderFormCase {
  /** "Full denture (upper)", as Treatments lists it. */
  title: string;
  service: ServiceRow;
  status?: StageStatus;
  /** A staged full denture's five stages. */
  stages?: StageRow[];
  /** Its own cards: a denture's stage cards, else its own instructions. */
  instructions: Card[];
}

export interface OrderFormModel {
  id: string;
  /** "Scanner · 3Shape", "Impressions (By Post) · Royal Mail" */
  receivedVia: string;
  url: string;
  patient: { name: string; dob: string; sex?: string };
  dentist: { name: string; detail?: string };
  practice: { name: string; address: string };
  lab: { name: string; address: string };
  /** The Treatments: "Full denture (upper)", or each service of a multi-service case. */
  caseType: string[];
  /** "NHS", "Private", or "NHS / Private" when the services differ: shown in the Treatments box. */
  orderType?: string;
  notation: Notation;
  /** `groups`: several cases, each treatment's teeth (its colour and its numbered lines on the chart). */
  chart: { teeth: string[]; pontics: string[]; groups?: { teeth: string[]; n: number }[] };
  /** A staged full denture: all five stages in order, each made here, done elsewhere, ordered on this case or not yet. */
  stages?: StageRow[];
  services: ServiceRow[];
  instructions: Card[];
  /**
   * An order with several cases, drawn in place of the Stage History, Service Details and per-service
   * cards. `instructions` then holds only the order's own.
   */
  cases?: OrderFormCase[];
}

/**
 * The form's look (5-Nov-2026, the user: labs aren't used to colours, "simple white professional design"): white,
 * black and greys only, one plain system sans serif, small uppercase section titles over hairline rules. Since 6-Nov
 * the Smile Genius logo is black and white too.
 */
const FORM_FONT = '"Segoe UI", "Helvetica Neue", Helvetica, Arial, sans-serif';
const INK = 'text-[#1A1A1F]';
const MUTED = 'text-[#6B6B75]';
const RULE = 'border-[#D9D9DE]';

/** A stage's or case's status, as plain text. */
function StatusPill({ status }: { status?: StageStatus }) {
  if (!status) return <span className="text-[#A0A0B0]">—</span>;
  return <span className={`whitespace-nowrap ${INK}`}>{status}</span>;
}

/** The sheet's own width, so it lays out for the narrow service panel and for Full View alike. */
function useWidth() {
  const ref = useRef<HTMLDivElement>(null);
  const [w, setW] = useState(480);
  useLayoutEffect(() => {
    const el = ref.current;
    if (!el) return;
    const measure = () => setW(el.clientWidth || 480);
    measure();
    if (typeof ResizeObserver === 'undefined') return;
    const ro = new ResizeObserver(measure);
    ro.observe(el);
    return () => ro.disconnect();
  }, []);
  return [ref, w] as const;
}

/**
 * `roomy` forces the wide layout (the print copy has no width to measure). `settings`: the lab's Settings › Order Form
 * (12-Nov), the saved ones unless the Settings tab passes its unsaved draft for the live preview.
 */
export default function OrderFormSheet({ model, roomy: forceRoomy, settings }: { model: OrderFormModel; roomy?: boolean; settings?: OrderFormSettings }) {
  const saved = useOrderFormSettings();
  const s = settings ?? saved;
  // The lab's logo heads the form; Smile Genius then signs off at its foot.
  const labLogo = s.showLogo ? s.logo : null;
  const em = s.emphasis;
  const regs = [s.mhra.trim() && `MHRA ${s.mhra.trim()}`, s.damas.trim() && `DAMAS ${s.damas.trim()}`].filter(Boolean).join(' · ');
  const [ref, w] = useWidth();
  const roomy = forceRoomy || w >= 640;
  const single = model.services.length === 1;
  const cases = model.cases;
  const notation = NOTATIONS.find(x => x.id === model.notation)?.label ?? 'FDI';
  // Each copy of the sheet (panel, Full View, print) needs its own gradient id, or the logo's smile
  // takes the hidden print copy's and doesn't show.
  const gid = `of_grad_${useId().replace(/[^a-zA-Z0-9_-]/g, '')}`;
  // A one-denture case's delivery days are its stages' (in the history), so the column goes.
  const showDelivery = model.services.some(s => s.delivery);

  return (
    <div ref={ref} className={`space-y-2 ${INK}`} style={{ fontFamily: FORM_FONT }}>
      {/* Header: Patient and Order ID on one row, the logo on the right; a dark rule under it. The QR codes are at
          the foot of the sheet (6-Nov). */}
      <div className="flex items-center gap-3 pb-2 border-b border-[#2B2B33]">
        {/* As the Dentist / Practice boxes below, without the boxes: each label on top, its value under it
            (5-Nov: no DOB or gender on the form). */}
        <dl className="min-w-0 flex-1 flex flex-wrap gap-x-8 gap-y-1.5">
          {([['Patient', model.patient.name], ['Order ID', model.id]] as const)
            .map(([k, v]) => (
              <div key={k} className="min-w-0">
                <FieldText label={k} value={v} as="dl" nowrap={k !== 'Patient'} strong={em && k === 'Patient'} />
              </div>
            ))}
        </dl>
        {/* Black and white (6-Nov): the smile in the wordmark's own dark grey, so the form has no colour at all. */}
        {labLogo
          ? <img src={labLogo} alt={`${model.lab.name} logo`} className={`${roomy ? 'max-w-[170px] max-h-12' : 'max-w-[110px] max-h-9'} object-contain flex-shrink-0 self-start`} />
          : <SmileGeniusWordmark gradientId={gid} smileFill="#3C3C3C" className={`${roomy ? 'w-36' : 'w-24'} h-auto flex-shrink-0 self-start`} />}
      </div>

      {/* Who and where, in two rows. */}
      <Fields cols={roomy ? 'grid-cols-3' : 'grid-cols-2'}>
        {/* The practice and the address the work ships back to, in one box on the left (6-Nov); wide, it spans both rows. */}
        <Field
          label="Practice"
          value={<>
            {model.practice.name}
            {/* Its own heading over the address (6-Nov), as the other boxes have. */}
            <span className={`block mt-1.5 text-[9.5px] leading-tight font-normal ${MUTED}`}>Ship to Address</span>
            {/* The same type as every other box's value (semibold, 11.5px, from FieldText). */}
            <span className="block">{model.practice.address}</span>
          </>}
          className={roomy ? 'row-span-2' : ''}
        />
        <Field label="Dentist" strong={em} value={<>{model.dentist.name}{model.dentist.detail && <span className="ml-1.5 text-[10.5px] font-normal text-[#4A4A5A]">{model.dentist.detail}</span>}</>} />
        {/* The lab's registration numbers (Settings › Order Form) under its name. */}
        <Field label="Lab" value={model.lab.name} sub={regs || undefined} />
        <Field label="Received via" value={model.receivedVia} />
        <Field
          label={cases ? `Treatments · ${cases.length}` : 'Treatments'}
          value={cases
            // Each numbered as on the chart's lines.
            ? <span className="flex flex-wrap gap-x-3 gap-y-0.5">{model.caseType.map((t, i) => <span key={i} className="inline-flex items-center gap-1"><CaseNo n={i + 1} />{t}</span>)}</span>
            : model.caseType.join(' · ')}
          // On the heading's line, on the right (6-Nov).
          aside={model.orderType && <>Order type: <span className={`font-semibold ${INK}`}>{model.orderType}</span></>}
        />
      </Fields>

      {/* No legend (5-Nov: it doesn't scale to 5–6 treatments): Treatments above gives each one's number. */}
      <Block
        title="Tooth Chart"
        aside={<span className={`text-[10px] ${MUTED} whitespace-nowrap`}>Tooth System: <span className={`ml-0.5 font-semibold ${INK}`}>{notation}</span></span>}
      >
        <div className="px-2 pt-1.5 pb-2">
          {/* The full width, up to about a page's: a wider sheet (laid out to be scaled onto the page) mustn't grow it. */}
          <div className="mx-auto max-w-[720px]">
            {/* Teeth a little smaller than their places (6-Nov: larger than the 5-Nov half size, so the shaded line art reads,
                as on a scanner's Rx; a touch shorter than wide so the chart stays compact). In grey (mono): several
                treatments are told apart by their numbered lines. */}
            <TeethChart selected={model.chart.teeth} pontics={model.chart.pontics} groups={model.chart.groups} toothHeight={0.62} toothWidth={0.74} mono readOnly notation={model.notation} label="Teeth on this order" />
          </div>
        </div>
      </Block>

      {cases ? (
        <>
          {/* One row a case, numbered as on the chart. Narrow, its details go under its name. */}
          <Block title="Treatments" aside={<span className={`text-[10px] ${MUTED}`}>{cases.length} cases</span>}>
            <Table
              cols={roomy ? ['#', 'Treatment', 'Teeth / Arch', 'Material', 'Tooth Shade', 'Other Details', 'Delivery', 'Status'] : ['#', 'Treatment', 'Delivery', 'Status']}
              widths={['w-6']}
              rows={cases.map((c, i) => {
                const s = c.service;
                const name = <span className="font-semibold">{c.title}</span>;
                return roomy
                  ? [<CaseNo n={i + 1} />, name, s.where, s.material, s.shade, s.other || <Dash />, <Due d={s.delivery} em={em} />, <StatusPill status={c.status} />]
                  : [<CaseNo n={i + 1} />, <>{name}<span className={`block text-[10px] ${MUTED}`}>{[s.where, s.material, s.shade, s.other].filter(x => x && x !== '—').join(' · ')}</span></>, <Due d={s.delivery} em={em} />, <StatusPill status={c.status} />];
              })}
            />
          </Block>
          {cases.map((c, i) => c.stages && (
            <Block key={i} title="Denture Stage History" icon={<CaseNo n={i + 1} />} aside={<span className={`text-[10.5px] ${MUTED} truncate`}>{c.title}</span>}>
              <StageTable stages={c.stages} em={em} />
            </Block>
          ))}
          {/* Every case's cards, each with its case's number, then the order's own. */}
          <Block title="Instructions" strong={em}>
            <div className={`p-2 ${cardsLayout(roomy)}`}>
              {cases.flatMap((c, i) => c.instructions.map((card, k) => <InstructionCard key={`${i}-${k}`} c={card} caseNo={i + 1} strong={em} />))}
              {model.instructions.map((c, k) => <InstructionCard key={`o${k}`} c={c} strong={em} />)}
            </div>
          </Block>
        </>
      ) : (
        <>
          {model.stages && (
            <Block title="Denture Stage History">
              <StageTable stages={model.stages} em={em} />
            </Block>
          )}

          <Block title={single ? `Service Details (${model.services[0].name})` : 'Service Details'}>
            <Table
              cols={['Service Name', 'Teeth / Arch', 'Material', 'Tooth Shade', 'Other Details', ...(showDelivery ? ['Delivery'] : [])]}
              rows={model.services.map(sv => [sv.name, sv.where, sv.material, sv.shade, sv.other, ...(showDelivery ? [<Due d={sv.delivery} em={em} />] : [])])}
            />
          </Block>

          <Block title="Instructions" strong={em}>
            <div className={`p-2 ${cardsLayout(roomy && model.instructions.length > 1)}`}>
              {model.instructions.length === 0 && <p className={`px-1 text-[11px] ${MUTED}`}>No instructions on this order.</p>}
              {model.instructions.map((c, i) => <InstructionCard key={i} c={c} strong={em} />)}
            </div>
          </Block>
        </>
      )}

      {s.statementOn && <div data-of-part="statement"><Statement model={model} s={s} roomy={roomy} /></div>}

      {/* The foot of the sheet (6-Nov), up to three separate sections: open the case (the code alone, always), the
          how-to video with the four steps it shows, and help (each of the last two can be turned off in Settings ›
          Order Form). */}
      <div
        className="grid gap-2"
        style={{
          gridTemplateColumns: roomy
            ? ['auto', s.showHowTo && 'minmax(0,1fr)', s.showHelp && (s.showHowTo ? 'minmax(0,220px)' : 'minmax(0,1fr)')].filter(Boolean).join(' ')
            : 'repeat(2, minmax(0,1fr))',
        }}
      >
        {/* Open this case stands out (6-Nov): a grey section, the code on a white tile so it still scans. */}
        <FootSection className={`bg-[#E9E9ED] border-[#C9C9D0] ${!roomy && !s.showHelp ? 'col-span-2' : ''}`}>
          <span className="p-1 rounded-sm bg-white flex-shrink-0"><FakeQr seed={model.url} size={roomy ? 44 : 38} /></span>
          <p className="text-[11px] font-bold leading-tight whitespace-nowrap">Open this case</p>
        </FootSection>
        {s.showHowTo && (
          <FootSection className={roomy ? '' : 'col-span-2 row-start-2'}>
            <FakeQr seed="smile-genius-lab-video" size={roomy ? 44 : 38} />
            <div className="min-w-0">
              <p className="text-[10.5px] font-semibold leading-tight">Watch how: open, accept, ship</p>
              {/* Four short steps (6-Nov: about 70% of the earlier wording), one line each, in an even 2 × 2 grid. */}
              <ol className={`mt-1 grid ${roomy ? 'grid-cols-2' : 'grid-cols-1'} gap-x-4 gap-y-1 text-[9px] leading-[12px] ${MUTED}`}>
                {[
                  <>Log in at <b className={INK}>dental.smilegeniusapp.com</b></>,
                  <>Search <b className={INK}>{model.id}</b>, review it</>,
                  <><b className={INK}>Accept</b> it, or ask the practice</>,
                  <>Once sent, mark it <b className={INK}>Shipped</b></>,
                ].map((step, i) => (
                  <li key={i} className="flex items-start gap-1 min-w-0">
                    <span className={`w-3 h-3 flex-shrink-0 rounded-full border border-[#3A3A44] text-[7.5px] leading-[10px] text-center font-bold ${INK}`}>{i + 1}</span>
                    {/* 12-Nov: steps wrap within their column (never run into the next one when the foot is narrow). */}
                    <span className="min-w-0 [overflow-wrap:anywhere]">{step}</span>
                  </li>
                ))}
              </ol>
            </div>
          </FootSection>
        )}
        {s.showHelp && (
          <FootSection>
            <FakeQr seed="smile-genius-support" size={roomy ? 44 : 38} />
            <div className="min-w-0">
              <p className="text-[10.5px] font-semibold leading-tight">Need help?</p>
              <p className={`text-[9px] leading-tight ${MUTED} mt-0.5 break-words`}>Trouble signing in? Scan to book time, or email</p>
              <p className={`text-[9px] leading-tight font-semibold ${INK} [overflow-wrap:anywhere]`}>support@smilegeniusdental.com</p>
            </div>
          </FootSection>
        )}
      </div>
      {/* The duplicate check (6-Nov): the one warning on the sheet, in ink with a heavier border (no colour on the form). */}
      {s.showDuplicateCheck && (
        <div role="note" className="flex items-start gap-2 px-2.5 py-1.5 rounded border-[1.5px] border-[#2B2B33]">
          <AlertTriangle aria-hidden className="w-3.5 h-3.5 mt-px flex-shrink-0" strokeWidth={2.25} />
          <p className="text-[10px] leading-snug">
            <b>Please check for duplicates.</b> Before you start, make sure this case isn’t already in Smile Genius. If it is, message the practice before making anything.
          </p>
        </div>
      )}
      {/* With the lab's logo at the top, Smile Genius signs off here. */}
      {labLogo && (
        <div className={`flex items-center justify-end gap-1.5 text-[9px] ${MUTED}`}>
          Powered by
          <SmileGeniusWordmark gradientId={`${gid}_foot`} smileFill="#3C3C3C" className="w-16 h-auto" />
        </div>
      )}
    </div>
  );
}

// ─── Full view ───────────────────────────────────────────────────────────────

/** The page inside its 10 mm margins, in CSS px (a little short of the page, so rounding never adds one). */
const MM = 96 / 25.4;
const pageBox = (paper: PaperSize) => ({ w: PAPER[paper].inner.w * MM, h: PAPER[paper].inner.h * MM });

/**
 * The scale the page copy (`ref`) prints at: the largest at which it fits one page. At scale s the copy is laid out
 * PAGE_W / s wide (so it fills the page once scaled) and must be no taller than PAGE_H / s. Laid out wider it gets
 * shorter, so a bisection finds it. The copy's width is kept set to match.
 */
function usePageFit(ref: RefObject<HTMLDivElement>, paper: PaperSize) {
  const { w: PAGE_W, h: PAGE_H } = pageBox(paper);
  const [fit, setFit] = useState(1);
  useLayoutEffect(() => {
    const el = ref.current;
    if (!el) return;
    const heightAt = (s: number) => { el.style.width = `${PAGE_W / s}px`; return el.scrollHeight; };
    const measure = () => {
      let best = 1;
      if (heightAt(1) > PAGE_H) {
        let lo = 0.3, hi = 1;
        for (let k = 0; k < 12; k++) {
          const mid = (lo + hi) / 2;
          if (mid * heightAt(mid) <= PAGE_H) lo = mid; else hi = mid;
        }
        best = Math.floor(lo * 1000) / 1000;
      }
      el.style.width = `${PAGE_W / best}px`;
      setFit(best);
    };
    measure();
    if (typeof ResizeObserver === 'undefined') return;
    const ro = new ResizeObserver(measure);
    ro.observe(el);
    return () => ro.disconnect();
  }, [ref, PAGE_W, PAGE_H]);
  return fit;
}

/**
 * The same one page as Print, saved as `Order-Form-<id>.pdf`: the page copy (`el`, laid out PAGE_W / fit wide in an
 * off-screen, hidden holder) drawn to an image, the holder shown for the capture, and placed on an A4 page inside
 * the same 10 mm margins.
 */
async function savePdf(el: HTMLElement, id: string, paper: PaperSize) {
  const page = PAPER[paper];
  const holder = el.parentElement;
  const was = holder?.style.visibility ?? '';
  const [{ toJpeg }, { jsPDF }] = await Promise.all([import('html-to-image'), import('jspdf')]);
  try {
    if (holder) holder.style.visibility = 'visible';
    // JPEG, not PNG: a page drawn at twice the size is ~15 MB as PNG in the PDF, well under 1 MB as JPEG.
    const img = await toJpeg(el, {
      // The form is in the system font (FORM_FONT), which the drawing has without any web font to embed.
      pixelRatio: 2, quality: 0.92, backgroundColor: '#ffffff', style: { transform: 'none' }, skipFonts: true,
    });
    const pdf = new jsPDF({ unit: 'mm', format: paper === 'Letter' ? 'letter' : 'a4', compress: true });
    // Laid out to the page's printable width once scaled, its height then fits the printable height.
    pdf.addImage(img, 'JPEG', 10, 10, page.inner.w, (page.inner.w * el.scrollHeight) / el.offsetWidth);
    pdf.save(`Order-Form-${id}.pdf`);
  } finally {
    if (holder) holder.style.visibility = was;
  }
}

/**
 * A PDF of a case's order form without opening it (the walkthrough's Download PDF): the page copy laid out off
 * screen, fitted to the page as Full View's is, saved once it has settled; then `onDone` (ok or not).
 */
export function OrderFormPdfJob({ model, onDone }: { model: OrderFormModel; onDone: (ok: boolean) => void }) {
  const ref = useRef<HTMLDivElement>(null);
  const s = useOrderFormSettings();
  const fit = usePageFit(ref, s.paper);
  const PAGE_W = pageBox(s.paper).w;
  useEffect(() => {
    // The fit and the chart's own measuring settle within a frame or two of mounting.
    const t = setTimeout(() => {
      if (!ref.current) return;
      savePdf(ref.current, model.id, s.paper).then(() => onDone(true), () => onDone(false));
    }, 400);
    return () => clearTimeout(t);
  }, []); // eslint-disable-line react-hooks/exhaustive-deps
  return createPortal(
    <div aria-hidden style={{ position: 'fixed', left: -100000, top: 0, visibility: 'hidden', pointerEvents: 'none' }}>
      <div ref={ref} style={{ width: PAGE_W / fit, transform: `scale(${fit})`, transformOrigin: 'top left' }}>
        <OrderFormSheet model={model} roomy settings={s} />
      </div>
    </div>,
    document.body,
  );
}

/**
 * The whole sheet at reading size, opened from the Order form tab bar's full-screen button (or its Print,
 * with `autoPrint`, which opens the print dialog straight away). Print sends only the sheet: a body-level
 * copy, as the label preview does, always on one page. The copy is laid out off screen at the page's width;
 * when it's taller than the page it's laid out wider and scaled down to fit, so it never runs onto a second.
 */
export function OrderFormFullView({ model, onClose, autoPrint, settings }: { model: OrderFormModel; onClose: () => void; autoPrint?: boolean; settings?: OrderFormSettings }) {
  const printRef = useRef<HTMLDivElement>(null);
  const saved = useOrderFormSettings();
  const s = settings ?? saved;
  const paper = PAPER[s.paper];
  const fit = usePageFit(printRef, s.paper);
  const PAGE_W = pageBox(s.paper).w;
  // The on-screen page: the whole sheet of paper, fitted to the window ('fit') or at its real size ('actual').
  const pageW = paper.w * MM, pageH = paper.h * MM;
  const stageRef = useRef<HTMLDivElement>(null);
  const [zoomMode, setZoomMode] = useState<'fit' | 'actual'>('fit');
  const [stage, setStage] = useState({ w: 0, h: 0 });
  useLayoutEffect(() => {
    const el = stageRef.current;
    if (!el) return;
    const measure = () => {
      const cs = getComputedStyle(el);
      setStage({
        w: el.clientWidth - parseFloat(cs.paddingLeft) - parseFloat(cs.paddingRight),
        h: el.clientHeight - parseFloat(cs.paddingTop) - parseFloat(cs.paddingBottom),
      });
    };
    measure();
    const ro = new ResizeObserver(measure);
    ro.observe(el);
    return () => ro.disconnect();
  }, []);
  const zoom = zoomMode === 'actual' || !stage.w ? 1 : Math.min(stage.w / pageW, stage.h / pageH);
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => { if (e.key === 'Escape') onClose(); };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [onClose]);
  // After the print copy has laid out.
  useEffect(() => {
    if (!autoPrint) return;
    const t = setTimeout(() => window.print(), 150);
    return () => clearTimeout(t);
  }, [autoPrint]);

  // Download PDF: the print copy, saved as a file.
  const { toast } = useToast();
  const [saving, setSaving] = useState(false);
  const download = async () => {
    if (!printRef.current) return;
    setSaving(true);
    try {
      await savePdf(printRef.current, model.id, s.paper);
    } catch {
      toast.error('The PDF couldn’t be made. Use Print and choose “Save as PDF” instead.');
    } finally {
      setSaving(false);
    }
  };
  return (
    <ModalPortal>
      {/* Off screen (but laid out, so it can be measured) until printing; then the only thing on the page. */}
      <style>{`
        .of-print-root { position: fixed; left: -100000px; top: 0; width: ${paper.inner.w}mm; visibility: hidden; pointer-events: none; }
        @media print {
          @page { size: ${s.paper === 'Letter' ? 'letter' : 'A4'}; margin: 10mm; }
          body > *:not(.of-print-root) { display: none !important; }
          .of-print-root {
            position: static !important; visibility: visible !important; width: ${paper.inner.w}mm; height: ${paper.inner.h}mm; overflow: hidden;
            -webkit-print-color-adjust: exact; print-color-adjust: exact;
          }
        }
      `}</style>
      <div className="fixed inset-0 z-[110] flex items-center justify-center p-4" role="dialog" aria-modal="true" aria-label={`Order form ${model.id}`}>
        <div className="absolute inset-0 bg-black/40" onClick={onClose} />
        <div className="relative bg-white rounded-2xl shadow-2xl w-full max-w-[1100px] h-[94vh] flex flex-col overflow-hidden">
          <div className="flex items-center justify-between gap-3 px-6 py-4 border-b border-[#F0EFF6]">
            <div className="min-w-0">
              <p className="text-sm font-semibold text-[#030213]">Order Form · {model.id}</p>
              <p className="text-[11px] text-[#717182] mt-0.5 truncate">{model.patient.name} · {model.practice.name}</p>
            </div>
            <button onClick={onClose} aria-label="Close" className="w-8 h-8 rounded-lg hover:bg-[#F8F9FC] flex items-center justify-center text-[#717182] transition-colors flex-shrink-0">
              <X className="w-4 h-4" />
            </button>
          </div>
          {/* 12-Nov: the page exactly as it prints (paper, margins, the fitted sheet), whole in the window or at 100%. */}
          <div ref={stageRef} className={`flex-1 min-h-0 bg-[#E9E9EE] p-4 sm:p-6 ${zoomMode === 'actual' ? 'overflow-auto' : 'overflow-hidden flex items-start justify-center'}`}>
            <div className="mx-auto" style={{ width: pageW * zoom, height: pageH * zoom }}>
              <div
                className="bg-white shadow-[0_2px_12px_rgba(0,0,0,0.15)]"
                style={{ width: pageW, height: pageH, padding: 10 * MM, transform: `scale(${zoom})`, transformOrigin: 'top left' }}
              >
                <div style={{ width: PAGE_W, height: pageBox(s.paper).h, overflow: 'hidden' }}>
                  <div style={{ width: PAGE_W / fit, transform: `scale(${fit})`, transformOrigin: 'top left' }}>
                    <OrderFormSheet model={model} roomy settings={s} />
                  </div>
                </div>
              </div>
            </div>
          </div>
          {/* The header's × closes it, so the footer holds only the real actions. */}
          <div className="flex items-center justify-between gap-3 px-6 py-4 border-t border-[#F0EFF6]">
            <div className="flex items-center gap-3 min-w-0">
              <div className="inline-flex p-0.5 rounded-lg bg-[#F3F3F5] flex-shrink-0" role="group" aria-label="Zoom">
                {([['fit', 'Whole page'], ['actual', '100%']] as const).map(([m, label]) => (
                  <button
                    key={m}
                    type="button"
                    aria-pressed={zoomMode === m}
                    onClick={() => setZoomMode(m)}
                    className={`px-2.5 py-1 rounded-md text-[11px] font-semibold transition-colors ${zoomMode === m ? 'bg-white text-[#030213] shadow-sm' : 'text-[#717182] hover:text-[#030213]'}`}
                  >
                    {label}
                  </button>
                ))}
              </div>
              <p className="text-[11px] text-[#717182] truncate">
                {paper.label}, one page{fit < 0.995 ? ` (content scaled to ${Math.round(fit * 100)}%)` : ''}
              </p>
            </div>
            <div className="flex gap-2 flex-shrink-0">
              <button
                onClick={download}
                disabled={saving}
                className="inline-flex items-center gap-1.5 px-4 py-2 rounded-lg text-xs font-semibold text-[#4D8EF7] border border-[#C8D8FC] hover:bg-[#EEF4FF] disabled:opacity-60 disabled:cursor-wait transition-colors"
              >
                {saving ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <Download className="w-3.5 h-3.5" />}
                {saving ? 'Preparing PDF…' : 'Download PDF'}
              </button>
              <button
                onClick={() => window.print()}
                className="inline-flex items-center gap-1.5 px-4 py-2 rounded-lg text-xs font-semibold text-white bg-gradient-to-r from-[#4D8EF7] to-[#A59DFF] hover:opacity-90 transition-opacity"
              >
                <Printer className="w-3.5 h-3.5" />
                Print
              </button>
            </div>
          </div>
        </div>
      </div>
      {/* Print-only copy at body level: what the browser actually prints. */}
      <div className="of-print-root" aria-hidden>
        <div ref={printRef} style={{ width: PAGE_W / fit, transform: `scale(${fit})`, transformOrigin: 'top left' }}>
          <OrderFormSheet model={model} roomy settings={s} />
        </div>
      </div>
    </ModalPortal>
  );
}

// ─── Pieces ──────────────────────────────────────────────────────────────────

/** Labelled values in one box, split by hairlines (the gaps show the border colour through). */
/** One section of the sheet's foot: a code and what it's for, in a hairline box. */
function FootSection({ className = '', children }: { className?: string; children: ReactNode }) {
  return <div className={`flex items-center gap-2 min-w-0 px-2 py-1.5 rounded border ${className.includes('border-[') ? '' : RULE} ${className}`}>{children}</div>;
}

function Fields({ cols, children }: { cols: string; children: ReactNode }) {
  return <div className={`grid ${cols} gap-px bg-[#D9D9DE] border ${RULE} rounded overflow-hidden`}>{children}</div>;
}

function Field({ label, value, sub, aside, strong, className = '' }: { label: string; value: ReactNode; sub?: string; aside?: ReactNode; strong?: boolean; className?: string }) {
  return (
    <div className={`bg-white px-2.5 py-1.5 min-w-0 ${className}`}>
      <FieldText label={label} value={value} aside={aside} strong={strong} />
      {sub && <p className={`text-[10.5px] ${MUTED} leading-snug break-words`}>{sub}</p>}
    </div>
  );
}

/** A field's label over its value: the details boxes' type, and the header's (`as="dl"`: a term and its description). */
function FieldText({ label, value, as, nowrap, aside, strong }: { label: string; value: ReactNode; as?: 'dl'; nowrap?: boolean; aside?: ReactNode; strong?: boolean }) {
  const Label = as ? 'dt' : 'p';
  const Value = as ? 'dd' : 'div';
  return (
    <>
      {/* `aside`: something said on the label's line, at its right (Treatments' order type). */}
      <Label className={`text-[9.5px] leading-tight ${MUTED} ${aside ? 'flex items-baseline justify-between gap-2' : ''}`}>
        {aside ? <><span>{label}</span><span className="whitespace-nowrap">{aside}</span></> : label}
      </Label>
      {/* 12-Nov: every field value has one size and weight; field emphasis no longer enlarges patient / dentist. */}
      <Value className={`text-[11.5px] font-semibold leading-snug ${INK} ${nowrap ? 'whitespace-nowrap' : 'break-words'}`}>{value}</Value>
    </>
  );
}

/** A section: its title small, upper case and dark on a light grey bar, over a hairline. */
function Block({ title, aside, icon, strong, children }: { title: string; aside?: ReactNode; icon?: ReactNode; strong?: boolean; children: ReactNode }) {
  return (
    // Emphasis: an ink border, as the duplicate check has.
    <section className={`rounded ${strong ? 'border-[1.5px] border-[#2B2B33]' : `border ${RULE}`} overflow-hidden bg-white`}>
      <div className={`flex items-center justify-between gap-2 px-2.5 py-1 bg-[#F5F5F7] border-b ${RULE}`}>
        <h3 className="inline-flex items-center gap-1.5 text-[10.5px] font-bold uppercase tracking-[0.08em] text-[#2B2B33]">{icon}{title}</h3>
        {aside}
      </div>
      {children}
    </section>
  );
}

function Table({ cols, rows, widths = [] }: { cols: string[]; rows: ReactNode[][]; widths?: string[] }) {
  return (
    <div className="overflow-x-auto">
      <table className="w-full text-left text-[11px]">
        <thead>
          <tr className="border-b border-[#E4E4E8]">
            {cols.map((c, i) => (
              <th key={c} className={`px-2.5 py-1 text-[9.5px] font-semibold ${MUTED} whitespace-nowrap ${widths[i] ?? ''}`}>{c}</th>
            ))}
          </tr>
        </thead>
        <tbody className="divide-y divide-[#EDEDF0]">
          {rows.map((r, i) => (
            <tr key={i}>
              {r.map((cell, j) => <td key={j} className="px-2.5 py-[3px] align-top leading-snug">{cell}</td>)}
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}

const Dash = () => <span className="text-[#A0A0B0]">—</span>;

/** A requested delivery date, bold with field emphasis on. */
const Due = ({ d, em }: { d?: string; em?: boolean }) => (d ? <span className={em ? 'font-bold' : ''}>{d}</span> : <Dash />);

function StageTable({ stages, em }: { stages: StageRow[]; em?: boolean }) {
  return (
    <Table
      cols={['#', 'Stage Name', 'Creation Date', 'Requested Delivery Date', 'Status']}
      widths={['w-7', '', '', '', 'w-24']}
      rows={stages.map(s => [
        <span className={MUTED}>{s.n}</span>,
        // The case it was made on, beside its name (one line a stage).
        <span className={s.status ? 'font-semibold' : MUTED}>
          {s.name}
          {s.caseId && <span className={`ml-1.5 text-[10px] font-normal ${MUTED}`}>{s.caseId}</span>}
        </span>,
        s.created ?? <Dash />,
        <Due d={s.due} em={em} />,
        <StatusPill status={s.status} />,
      ])}
    />
  );
}

/** Instruction cards: two to a row on the wide sheet (it keeps the page to one), else one under another. */
const cardsLayout = (twoUp: boolean) => (twoUp ? 'grid grid-cols-2 gap-1.5' : 'space-y-1.5');

/**
 * One instruction, plain (5-Nov: no status colours or pills, the stage history has the status): a number, then
 * the title and the text. The number is the case's (as on the chart) on an order of several, else the stage's.
 */
function InstructionCard({ c, caseNo, strong }: { c: Card; caseNo?: number; strong?: boolean }) {
  const n = caseNo ?? c.n;
  return (
    <div className={`rounded border ${RULE} bg-white px-2.5 py-1.5`}>
      <div className="flex items-start gap-2">
        {n !== undefined && <span className="mt-px"><CaseNo n={n} /></span>}
        <div className="flex-1 min-w-0">
          <p className="text-[11px] font-semibold leading-snug">{c.title}</p>
          <p className={`text-[11px] ${strong ? INK : 'text-[#3A3A44]'} leading-snug whitespace-pre-line`}>{c.text}</p>
        </div>
      </div>
    </div>
  );
}

/** A number in a thin dark ring: a case's (the Treatments list and row, the chart's lines, its cards) or a stage's. */
const CaseNo = ({ n }: { n: number }) => (
  <span className={`w-4 h-4 rounded-full border border-[#2B2B33] bg-white ${INK} text-[9px] font-bold flex items-center justify-center flex-shrink-0 tabular-nums`}>
    {n}
  </span>
);

/**
 * The lab's conformity statement for a custom-made device (Settings › Order Form): the UK and/or EU wording filled
 * from the case, then who signs it (a typed signature, or a blank line to sign in ink), with the date and place.
 */
function Statement({ model, s, roomy }: { model: OrderFormModel; s: OrderFormSettings; roomy: boolean }) {
  const vars = {
    id: model.id, patient: model.patient.name, prescriber: model.dentist.name,
    practice: [model.practice.name, model.practice.address].filter(Boolean).join(', '),
    labName: model.lab.name, labAddress: model.lab.address,
  };
  // The place of issue: the address's last part without its postcode ("Sheffield S3 8RY" → "Sheffield").
  const lastPart = model.lab.address.split(/,|\n/).map(x => x.trim()).filter(Boolean).pop() ?? '';
  const town = lastPart.replace(/\s*[A-Z]{1,2}\d[A-Z\d]?\s*\d[A-Z]{2}$/i, '').trim();
  const today = new Date().toLocaleDateString('en-GB', { day: 'numeric', month: 'short', year: 'numeric' });
  return (
    <Block title="Statement · Custom-made device">
      <div className="px-2.5 py-1.5 space-y-1">
        {jurisdictions(s.jurisdiction).map(j => (
          <p key={j} className="text-[9.5px] leading-snug text-[#3A3A44]">
            <b className={`mr-1 ${INK}`}>{j}</b>
            {fillTokens(j === 'UK' ? s.ukText : s.euText, vars, s)}
          </p>
        ))}
      </div>
      <div className={`flex ${roomy ? '' : 'flex-wrap'} items-end gap-x-6 gap-y-1 px-2.5 pt-1 pb-1.5 border-t border-[#EDEDF0]`}>
        <div className="min-w-0">
          {s.signatureMode === 'typed'
            // 12-Nov: the signature itself is twice its earlier size (typed 34px, image 56px tall, blank line 2× room).
            ? <span className={`block border-b border-[#1A1A1F] pr-6 ${INK}`} style={{ fontFamily: SIGNATURE_FONT, fontSize: 34, lineHeight: 1.15 }}>{s.signerName || '—'}</span>
            : s.signatureMode === 'image' && s.signatureImage
              ? <span className="block border-b border-[#1A1A1F] pr-6"><img src={s.signatureImage} alt={`Signature of ${s.signerName || 'the signer'}`} className="block h-14 max-w-[22rem] object-contain object-left" /></span>
              : <span className="block w-[22rem] max-w-full h-10 border-b border-[#1A1A1F]" />}
          <p className={`text-[9px] ${MUTED} mt-0.5`}>Signed</p>
        </div>
        <div className="min-w-0">
          <p className="text-[10.5px] font-semibold leading-tight">{s.signerName || '—'}</p>
          <p className={`text-[9px] ${MUTED}`}>{[s.signerTitle, model.lab.name].filter(Boolean).join(', ')}</p>
        </div>
        <div className="min-w-0">
          <p className="text-[10.5px] font-semibold leading-tight whitespace-nowrap">{today}{town ? ` · ${town}` : ''}</p>
          <p className={`text-[9px] ${MUTED}`}>Date and place</p>
        </div>
      </div>
    </Block>
  );
}
