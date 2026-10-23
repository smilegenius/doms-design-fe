// ─── New Case Flow · Sent screen, Undo and box label ─────────────────────────

import { useEffect, useRef, useState } from 'react';
import { CheckCircle2, Printer, Undo2, ArrowRight, X, Clock } from 'lucide-react';
import ModalPortal from '../components/ModalPortal';
import { CLINIC, Lab, Patient } from './data';
import { labSees } from './rules';
import { demoNow } from './dates';
import { PrimaryButton, SecondaryButton, FOCUS } from './ui';

export interface SentCase { id: string; summary: string; backBy?: string; fitFrom?: string; fit?: string }
export interface SentResult {
  heading: string;
  cases: SentCase[];
  posted: boolean;
  approval: boolean;
  box?: string[];
  disinfected?: string;
  lab: Lab;
  patient: Patient;
  next?: { id: string; text: string };
}

export default function SentView({ result, onBack, onView, onNext }: {
  result: SentResult; onBack: () => void; onView: (id: string) => void; onNext: (id: string) => void;
}) {
  const [label, setLabel] = useState<string | null>(null);
  const heading = useRef<HTMLHeadingElement>(null);
  useEffect(() => { heading.current?.focus(); }, []);
  const p = result.patient;
  return (
    <div className="max-w-[760px] mx-auto py-10">
      <div className="flex items-center gap-3 mb-6">
        <span className="w-12 h-12 rounded-2xl bg-[#F0FDF4] border border-[#BBF7D0] flex items-center justify-center" aria-hidden>
          {result.approval ? <Clock className="w-6 h-6 text-[#15803D]" /> : <CheckCircle2 className="w-6 h-6 text-[#15803D]" />}
        </span>
        <h1 ref={heading} tabIndex={-1} className="text-2xl font-bold text-[#030213] focus:outline-none">{result.heading}</h1>
      </div>
      <div className="space-y-3">
        {result.cases.map(c => (
          <div key={c.id} className="bg-white border border-[#E0E0E6] rounded-2xl p-5">
            <p className="text-sm font-semibold text-[#030213]">{c.id} · {p.first} {p.last}</p>
            <p className="text-sm text-[#3A3A4A] mt-1">{c.summary}</p>
            {!result.approval && c.backBy && (
              <p className="text-sm text-[#1F1F2E] mt-2">{c.backBy}{c.fit ? ` ${p.first}’s fit is on ${c.fit}.` : c.fitFrom ? ` Book ${p.first}’s fit from ${c.fitFrom}.` : ''}</p>
            )}
            <div className="mt-4 flex flex-wrap gap-2">
              {result.posted && !result.approval && <PrimaryButton onClick={() => setLabel(c.id)}><Printer className="w-4 h-4" aria-hidden />Print Box Label</PrimaryButton>}
              <SecondaryButton onClick={() => onView(c.id)}>View Case</SecondaryButton>
            </div>
          </div>
        ))}
      </div>
      <div className="mt-6 flex flex-wrap items-center gap-3">
        {result.posted && !result.approval ? <SecondaryButton onClick={onBack}>Back to Cases</SecondaryButton> : <PrimaryButton onClick={onBack}>Back to Cases</PrimaryButton>}
      </div>
      {result.next && (
        <div className="mt-6 flex items-center gap-3 px-4 py-3 rounded-xl bg-[#F5F8FF] border border-[#D6E2FB]">
          <p className="text-sm text-[#1F1F2E] flex-1">Next scan waiting: <span className="font-semibold">{result.next.text}</span></p>
          <SecondaryButton onClick={() => onNext(result.next!.id)}>Open<ArrowRight className="w-3.5 h-3.5" aria-hidden /></SecondaryButton>
        </div>
      )}
      {label && <BoxLabel caseId={label} result={result} onClose={() => setLabel(null)} />}
    </div>
  );
}

/** "Sent. Undo (10)": the lab isn't told until the countdown ends. */
export function UndoToast({ seconds = 10, onUndo, onExpire }: { seconds?: number; onUndo: () => void; onExpire: () => void }) {
  const [left, setLeft] = useState(seconds);
  const expire = useRef(onExpire);
  expire.current = onExpire;
  useEffect(() => {
    if (left <= 0) { expire.current(); return; }
    const t = setTimeout(() => setLeft(l => l - 1), 1000);
    return () => clearTimeout(t);
  }, [left]);
  return (
    <ModalPortal>
      <div className="fixed bottom-6 left-1/2 -translate-x-1/2 z-[120] flex items-center gap-4 pl-5 pr-3 py-3 rounded-2xl bg-[#030213] text-white shadow-2xl">
        {/* Announced once; the countdown itself is hidden from screen readers. */}
        <p className="text-sm font-medium" role="status">Sent. You can undo for {seconds} seconds.</p>
        <span className="text-sm tabular-nums text-white/70" aria-hidden>({left})</span>
        <button type="button" onClick={onUndo} className={`inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-white text-[#030213] text-sm font-semibold hover:bg-[#F0EFF6] ${FOCUS}`}>
          <Undo2 className="w-4 h-4" aria-hidden />Undo
        </button>
      </div>
    </ModalPortal>
  );
}

function BoxLabel({ caseId, result, onClose }: { caseId: string; result: SentResult; onClose: () => void }) {
  const p = result.patient;
  return (
    <ModalPortal>
      <div className="fixed inset-0 z-[115] flex items-center justify-center">
        <div className="absolute inset-0 bg-black/40" onClick={onClose} />
        <div role="dialog" aria-modal="true" aria-label="Box label" className="relative bg-white rounded-2xl shadow-2xl p-6 w-[520px]">
          <button type="button" onClick={onClose} aria-label="Close" className={`absolute right-4 top-4 p-1 rounded text-[#4A4A5A] ${FOCUS}`}><X className="w-4 h-4" /></button>
          <h2 className="text-base font-semibold text-[#030213] mb-4">Box label</h2>
          <div className="border-2 border-dashed border-[#030213] rounded-xl p-5 font-mono text-[13px] text-[#030213]">
            <div className="flex gap-4">
              <div className="w-20 h-20 grid grid-cols-9 gap-[1px] p-1 border border-[#030213] flex-shrink-0" aria-hidden>
                {Array.from({ length: 81 }, (_, i) => <span key={i} className={((i * 31) % 7) % 2 === 0 ? 'bg-[#030213]' : 'bg-white'} />)}
              </div>
              <div className="min-w-0">
                <p className="text-lg font-bold">{caseId}</p>
                <p>{labSees(p, demoNow())}</p>
                <p className="mt-1">To: {result.lab.name}, {result.lab.city}</p>
                <p>From: {CLINIC.name}, {CLINIC.city}</p>
              </div>
            </div>
            {result.box && <p className="mt-3">Contents: {result.box.join(', ')}</p>}
            {result.disinfected && <p className="mt-1">{result.disinfected}</p>}
          </div>
          <div className="mt-5 flex justify-end gap-2">
            <SecondaryButton onClick={onClose}>Close</SecondaryButton>
            <PrimaryButton onClick={() => { try { window.print(); } catch { /* print blocked */ } }}><Printer className="w-4 h-4" aria-hidden />Print</PrimaryButton>
          </div>
        </div>
      </div>
    </ModalPortal>
  );
}
