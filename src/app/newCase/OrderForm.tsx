// ─── New Case Flow · Dental Order Form ───────────────────────────────────────
// The order form a finished flow case shows in the portal's Case Details (its
// Order form panel, Full View and the Order Form modal), through the page's
// OrderFormSlot. The portal's own form is unchanged: only the flow sets the slot.
//
// One sheet for the whole case, as the lab reads it: who it's for and from,
// where it goes back to, the teeth on one chart, a staged denture's history
// (each stage made so far, with its dates, status and instructions, so a new
// stage adds a row and an instruction card), each service's prescription, and
// the scan and attachment files. The model is built from the flow's case in
// FlowCaseDetail (orderFormModel); this file only draws it.

import { ReactNode, useEffect, useLayoutEffect, useRef, useState } from 'react';
import { FileText, Mail, Package, Printer, ScanLine, X } from 'lucide-react';
import SmileGeniusWordmark from '../components/SmileGeniusWordmark';
import ModalPortal from '../components/ModalPortal';
import { FakeQr } from '../components/DispatchLabel';
import TeethChart from './TeethChart';
import { NOTATIONS, Notation } from './rules';

export type StageStatus = 'Done' | 'Done elsewhere' | 'In Progress' | 'Ready for Dispatch';

export interface OrderFormModel {
  id: string;
  /** "Scanner · 3Shape", "Impressions (By Post) · Royal Mail" */
  receivedVia: string;
  url: string;
  patient: { name: string; dob: string; sex?: string };
  dentist: { name: string; detail?: string };
  practice: { name: string; address: string };
  lab: { name: string; address: string };
  /** "Full denture (upper)", or each service of a multi-service case. */
  caseType: string[];
  notation: Notation;
  chart: { teeth: string[]; pontics: string[]; legend: string[] };
  /** A staged full denture: all five stages in order, each made here, done elsewhere, ordered on this case or not yet. */
  stages?: { n: number; name: string; created?: string; due?: string; status?: StageStatus; caseId?: string }[];
  services: { name: string; where: string; material: string; shade: string; other: string; delivery: string }[];
  instructions: { n?: number; title: string; text: string; status?: StageStatus }[];
  scans: { type: string; file: string; date: string }[];
  /** Said in the Scan Files block when there are no files (impressions by post, scan to follow). */
  scanNote?: string;
  attachments: { file: string; type: string; date: string }[];
}

const STATUS_STYLE: Record<StageStatus, string> = {
  Done: 'bg-[#E8F5E9] text-[#2E7D32] border-[#C8E6C9]',
  'Done elsewhere': 'bg-[#F3F3F5] text-[#5A5568] border-[#E0E0E6]',
  'In Progress': 'bg-[#FFF8E1] text-[#A16207] border-[#FDE68A]',
  'Ready for Dispatch': 'bg-[#FFF3E0] text-[#E65100] border-[#FFCC80]',
};
const NUMBER_STYLE: Record<StageStatus, string> = {
  Done: 'bg-[#2E7D32] text-white',
  'Done elsewhere': 'bg-[#717182] text-white',
  'In Progress': 'bg-[#F59E0B] text-white',
  'Ready for Dispatch': 'bg-[#E65100] text-white',
};
const CARD_STYLE: Record<StageStatus, string> = {
  Done: 'bg-[#F4FBF5] border-[#DCEFDF]',
  'Done elsewhere': 'bg-[#F8F9FC] border-[#E0E0E6]',
  'In Progress': 'bg-[#FFFBEB] border-[#FDECB5]',
  'Ready for Dispatch': 'bg-[#FFF8F1] border-[#FFE0B2]',
};

function StatusPill({ status }: { status?: StageStatus }) {
  if (!status) return <span className="text-[#A0A0B0]">—</span>;
  return (
    <span className={`inline-flex items-center px-2 py-0.5 rounded-full border text-[10px] font-semibold whitespace-nowrap ${STATUS_STYLE[status]}`}>
      {status}
    </span>
  );
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

/** `roomy` forces the wide layout (the print copy has no width to measure). */
export default function OrderFormSheet({ model, roomy: forceRoomy }: { model: OrderFormModel; roomy?: boolean }) {
  const [ref, w] = useWidth();
  const roomy = forceRoomy || w >= 640;
  const single = model.services.length === 1;
  const notation = NOTATIONS.find(x => x.id === model.notation)?.label ?? 'FDI';

  return (
    <div ref={ref} className="space-y-3 text-[#030213]">
      {/* Header: who made the form, the case and how it reached the lab */}
      <div className="flex items-start justify-between gap-3 flex-wrap pb-3 border-b border-[#F0EFF6]">
        <div className="min-w-0">
          <SmileGeniusWordmark gradientId={`of_grad_${model.id}`} className="w-32 h-auto" />
          <p className="text-[10px] font-bold uppercase tracking-[0.18em] text-[#717182] mt-1">Dental Order Form</p>
        </div>
        <div className="flex items-start gap-3 ml-auto">
          <div className="text-right space-y-0.5">
            <p className="text-xs"><span className="text-[#717182]">Order ID:</span> <span className="font-semibold">{model.id}</span></p>
            <p className="text-xs"><span className="text-[#717182]">Received via:</span> <span className="font-semibold">{model.receivedVia}</span></p>
          </div>
          <div className="flex flex-col items-center gap-1">
            <FakeQr seed={model.url} size={roomy ? 56 : 48} />
            <span className="text-[9px] text-[#717182] whitespace-nowrap">Scan to view case</span>
          </div>
        </div>
      </div>

      {/* Who and where */}
      <div className={`grid gap-2 ${roomy ? 'grid-cols-3' : 'grid-cols-2'}`}>
        <Info label="Patient Name" value={model.patient.name} sub={[`DOB: ${model.patient.dob}`, model.patient.sex].filter(Boolean).join(' · ')} />
        <Info label="Dentist Name" value={model.dentist.name} sub={model.dentist.detail} />
        <Info label="Practice Name" value={model.practice.name} />
        <Info label="Lab Name" value={model.lab.name} sub={model.lab.address} />
        <Info label="Ship to Address" value={model.practice.address} />
        <Info label="Case Type" value={model.caseType.join(' · ')} />
      </div>

      <Block
        title="Tooth Chart"
        aside={<span className="text-[10px] text-[#717182]">Tooth System: <span className="ml-0.5 px-1.5 py-0.5 rounded bg-white border border-[#E0E0E6] font-semibold text-[#030213]">{notation}</span></span>}
      >
        <div className="px-3 py-3">
          {/* Kept to a reading size: at full Full View width the chart would be taller than the rest of the sheet needs. */}
          <div className="max-w-[520px] mx-auto">
            <TeethChart selected={model.chart.teeth} pontics={model.chart.pontics} readOnly notation={model.notation} label="Teeth on this order" />
          </div>
          {model.chart.legend.length > 0 && (
            <div className="flex flex-wrap gap-x-4 gap-y-1 mt-2">
              {model.chart.legend.map(l => (
                <span key={l} className="inline-flex items-center gap-1.5 text-[11px] text-[#4A4A5A]">
                  {/* The chart's own selection colours (ToothShapes: the 'se' fill, TEAL_LINE). */}
                  <span className="w-2.5 h-2.5 rounded-sm bg-[#8DD4EC] border border-[#3FA8CA]" aria-hidden />
                  {l}
                </span>
              ))}
            </div>
          )}
        </div>
      </Block>

      {model.stages && (
        <Block title="Denture Stage History">
          <Table
            cols={['#', 'Stage Name', 'Creation Date', 'Requested Delivery Date', 'Status']}
            widths={['w-7', '', '', '', 'w-24']}
            rows={model.stages.map(s => [
              <span className="text-[#717182]">{s.n}</span>,
              <span className={s.status ? 'font-semibold' : ''}>
                {s.name}
                {s.caseId && <span className="block text-[10px] font-normal text-[#A0A0B0]">{s.caseId}</span>}
              </span>,
              s.created ?? <Dash />,
              s.due ?? <Dash />,
              <StatusPill status={s.status} />,
            ])}
          />
        </Block>
      )}

      <Block title={single ? `Service Details (${model.services[0].name})` : 'Service Details'}>
        <Table
          cols={['Service Name', 'Teeth / Arch', 'Material', 'Tooth Shade', 'Other Details', 'Delivery']}
          rows={model.services.map(s => [s.name, s.where, s.material, s.shade, s.other, s.delivery])}
        />
      </Block>

      <Block title="Instructions">
        <div className="p-2.5 space-y-2">
          {model.instructions.length === 0 && <p className="px-1 py-1 text-xs text-[#A0A0B0]">No instructions on this order.</p>}
          {model.instructions.map((c, i) => (
            <div key={i} className={`rounded-lg border px-3 py-2.5 ${c.status ? CARD_STYLE[c.status] : 'bg-[#F8F9FC] border-[#E0E0E6]'}`}>
              <div className="flex items-start gap-2.5">
                {c.n !== undefined && (
                  <span className={`w-5 h-5 rounded-full flex items-center justify-center text-[10px] font-bold flex-shrink-0 mt-px ${c.status ? NUMBER_STYLE[c.status] : 'bg-[#4D8EF7] text-white'}`}>{c.n}</span>
                )}
                <div className="flex-1 min-w-0">
                  <div className="flex items-start justify-between gap-2">
                    <p className="text-xs font-semibold">{c.title}</p>
                    {c.status && <StatusPill status={c.status} />}
                  </div>
                  <p className="text-xs text-[#4A4A5A] leading-relaxed mt-1 whitespace-pre-line">{c.text}</p>
                </div>
              </div>
            </div>
          ))}
        </div>
      </Block>

      <div className={`grid gap-3 ${roomy ? 'grid-cols-2' : 'grid-cols-1'}`}>
        <Block title="Scan Files" icon={<ScanLine className="w-3.5 h-3.5" />}>
          {model.scans.length > 0
            ? <Table cols={['Scan Type', 'File Name', 'Date Uploaded']} rows={model.scans.map(s => [s.type, s.file, s.date])} />
            : <Empty icon={model.scanNote?.startsWith('Impressions') ? <Package className="w-3.5 h-3.5" /> : <Mail className="w-3.5 h-3.5" />} text={model.scanNote ?? 'No scan files on this order.'} />}
        </Block>
        <Block title="Additional Attachment Files" icon={<FileText className="w-3.5 h-3.5" />}>
          {model.attachments.length > 0
            ? <Table cols={['File Name', 'Type', 'Date Uploaded']} rows={model.attachments.map(a => [a.file, a.type, a.date])} />
            : <Empty icon={<FileText className="w-3.5 h-3.5" />} text="No additional attachments." />}
        </Block>
      </div>
    </div>
  );
}

// ─── Full view ───────────────────────────────────────────────────────────────

/**
 * The whole sheet at reading size, opened from the Order form tab bar's full-screen button (or its Print,
 * with `autoPrint`, which opens the print dialog straight away). Print sends only the sheet: a body-level
 * copy, as the label preview does.
 */
export function OrderFormFullView({ model, onClose, autoPrint }: { model: OrderFormModel; onClose: () => void; autoPrint?: boolean }) {
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
  return (
    <ModalPortal>
      <style>{`
        .of-print-root { display: none; }
        @media print {
          @page { size: A4; margin: 12mm; }
          body > *:not(.of-print-root) { display: none !important; }
          .of-print-root { display: block !important; }
        }
      `}</style>
      <div className="fixed inset-0 z-[110] flex items-center justify-center p-4" role="dialog" aria-modal="true" aria-label={`Order form ${model.id}`}>
        <div className="absolute inset-0 bg-black/40" onClick={onClose} />
        <div className="relative bg-white rounded-2xl shadow-2xl w-full max-w-[920px] max-h-[92vh] flex flex-col">
          <div className="flex items-center justify-between gap-3 px-6 py-4 border-b border-[#F0EFF6]">
            <div className="min-w-0">
              <p className="text-sm font-semibold text-[#030213]">Order Form · {model.id}</p>
              <p className="text-[11px] text-[#717182] mt-0.5 truncate">{model.patient.name} · {model.practice.name}</p>
            </div>
            <button onClick={onClose} aria-label="Close" className="w-8 h-8 rounded-lg hover:bg-[#F8F9FC] flex items-center justify-center text-[#717182] transition-colors flex-shrink-0">
              <X className="w-4 h-4" />
            </button>
          </div>
          <div className="flex-1 overflow-y-auto bg-[#F3F3F5] p-5">
            <div className="mx-auto max-w-[840px] bg-white rounded-xl border border-[#E0E0E6] shadow-sm p-6">
              <OrderFormSheet model={model} />
            </div>
          </div>
          <div className="flex items-center justify-between gap-3 px-6 py-4 border-t border-[#F0EFF6]">
            <p className="text-[11px] text-[#717182]">A4 · Choose “Save as PDF” in the print window to download.</p>
            <div className="flex gap-2 flex-shrink-0">
              <button onClick={onClose} className="px-4 py-2 rounded-lg text-xs font-semibold text-[#5A5568] border border-[#E0E0E6] hover:bg-[#F8F9FC] transition-colors">
                Close
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
      <div className="of-print-root">
        <OrderFormSheet model={model} roomy />
      </div>
    </ModalPortal>
  );
}

// ─── Pieces ──────────────────────────────────────────────────────────────────

function Info({ label, value, sub }: { label: string; value: string; sub?: string }) {
  return (
    <div className="rounded-lg bg-[#F8F9FC] border border-[#F0EFF6] px-3 py-2 min-w-0">
      <p className="text-[10px] text-[#717182]">{label}</p>
      <p className="text-xs font-semibold leading-snug break-words">{value}</p>
      {sub && <p className="text-[11px] text-[#4A4A5A] leading-snug mt-0.5 break-words">{sub}</p>}
    </div>
  );
}

function Block({ title, aside, icon, children }: { title: string; aside?: ReactNode; icon?: ReactNode; children: ReactNode }) {
  return (
    <section className="rounded-xl border border-[#E0E0E6] overflow-hidden bg-white">
      <div className="flex items-center justify-between gap-2 px-3 py-2 bg-[#EEF4FF] border-b border-[#DCE7FD]">
        <h3 className="inline-flex items-center gap-1.5 text-[13px] font-semibold text-[#1565C0]">{icon}{title}</h3>
        {aside}
      </div>
      {children}
    </section>
  );
}

function Table({ cols, rows, widths = [] }: { cols: string[]; rows: ReactNode[][]; widths?: string[] }) {
  return (
    <div className="overflow-x-auto">
      <table className="w-full text-left text-xs">
        <thead>
          <tr className="bg-[#F8F9FC] border-b border-[#F0EFF6]">
            {cols.map((c, i) => (
              <th key={c} className={`px-3 py-1.5 text-[10px] font-semibold text-[#717182] whitespace-nowrap ${widths[i] ?? ''}`}>{c}</th>
            ))}
          </tr>
        </thead>
        <tbody className="divide-y divide-[#F0EFF6]">
          {rows.map((r, i) => (
            <tr key={i}>
              {r.map((cell, j) => <td key={j} className="px-3 py-1.5 align-top">{cell}</td>)}
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}

const Dash = () => <span className="text-[#A0A0B0]">—</span>;

function Empty({ icon, text }: { icon: ReactNode; text: string }) {
  return (
    <p className="flex items-center gap-2 px-3 py-2.5 text-xs text-[#717182]">
      <span className="text-[#A0A0B0]">{icon}</span>
      {text}
    </p>
  );
}
