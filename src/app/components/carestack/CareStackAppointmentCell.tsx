import { useEffect, useRef, useState } from 'react';
import { createPortal } from 'react-dom';
import { ChevronDown, Loader2, Link2, CalendarX2, Lock, CalendarCheck2, RefreshCw } from 'lucide-react';
import { SUMMARY_META, summariseCase, summaryLabel, useCaseCareStack } from '../../data/carestack';

// ─── Cases list · "CareStack Appointment" cell ───────────────────────────────
//   • Linked             → green chip with the appointment date and time
//                          (click = change the appointment).
//   • Appointment needed → one "Choose" button; its dropdown offers the two
//                          resolutions: Link Appointment · Not Required.
//   • Not required       → grey chip (click = link one after all).
//   • Everything else    → read-only state (checking / mapping incomplete).

export default function CareStackAppointmentCell({
  caseId, onLink, onNotRequired,
}: {
  caseId: string;
  onLink: () => void;
  onNotRequired: () => void;
}) {
  const rec = useCaseCareStack(caseId);
  const summary = summariseCase(rec);
  const meta = SUMMARY_META[summary];
  const busy = summary === 'checking' || summary === 'searching';

  // "Choose" dropdown — portalled to <body> at the button's screen position
  // so the table's horizontal scroll container can't clip it.
  const [open, setOpen] = useState(false);
  const btnRef = useRef<HTMLButtonElement>(null);
  const menuRef = useRef<HTMLDivElement>(null);
  const [pos, setPos] = useState<{ top: number; left: number } | null>(null);
  const toggle = () => {
    if (open) { setOpen(false); return; }
    const r = btnRef.current?.getBoundingClientRect();
    if (r) setPos({ top: r.bottom + 4, left: r.left });
    setOpen(true);
  };
  useEffect(() => {
    if (!open) return;
    const onDown = (e: MouseEvent) => {
      const t = e.target as Node;
      if (btnRef.current?.contains(t) || menuRef.current?.contains(t)) return;
      setOpen(false);
    };
    const close = () => setOpen(false);
    document.addEventListener('mousedown', onDown);
    window.addEventListener('scroll', close, true);
    window.addEventListener('resize', close);
    return () => {
      document.removeEventListener('mousedown', onDown);
      window.removeEventListener('scroll', close, true);
      window.removeEventListener('resize', close);
    };
  }, [open]);

  if (summary === 'required') {
    return (
      <div className="inline-block" onClick={e => e.stopPropagation()}>
        <button
          ref={btnRef}
          onClick={toggle}
          title="Choose how to resolve the CareStack appointment"
          className={`inline-flex items-center gap-1 pl-2.5 pr-1.5 py-0.5 rounded-full text-[10px] font-semibold border whitespace-nowrap transition-colors ${
            open ? 'bg-[#FEF3C7] text-[#92400E] border-[#FDE68A]' : 'bg-[#FFF8E1] text-[#B45309] border-[#FDE68A] hover:bg-[#FEF3C7]'
          }`}
        >
          Choose
          <ChevronDown className={`w-3 h-3 transition-transform ${open ? 'rotate-180' : ''}`} />
        </button>
        {open && pos && createPortal(
          <div
            ref={menuRef}
            style={{ position: 'fixed', top: pos.top, left: pos.left }}
            className="z-[80] bg-white rounded-xl border border-[#E0E0E6] shadow-xl py-1.5 min-w-[180px] w-max"
            onClick={e => e.stopPropagation()}
          >
            <button
              onClick={() => { setOpen(false); onLink(); }}
              className="w-full flex items-center gap-2.5 px-3.5 py-2 text-left text-xs font-medium text-[#030213] hover:bg-[#F8F9FC] transition-colors"
            >
              <Link2 className="w-3.5 h-3.5 text-[#4D8EF7]" />
              Link Appointment
            </button>
            <button
              onClick={() => { setOpen(false); onNotRequired(); }}
              className="w-full flex items-center gap-2.5 px-3.5 py-2 text-left text-xs font-medium text-[#030213] hover:bg-[#F8F9FC] transition-colors"
            >
              <CalendarX2 className="w-3.5 h-3.5 text-[#717182]" />
              Not Required
            </button>
          </div>,
          document.body,
        )}
      </div>
    );
  }

  if (summary === 'linked') {
    return (
      <button
        onClick={e => { e.stopPropagation(); onLink(); }}
        title="Linked CareStack appointment — click to change it"
        className={`group inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[10px] font-semibold border whitespace-nowrap hover:opacity-80 transition-opacity ${meta.cls}`}
      >
        <CalendarCheck2 className="w-3 h-3 group-hover:hidden" />
        <RefreshCw className="w-3 h-3 hidden group-hover:block" />
        {summaryLabel(rec)}
      </button>
    );
  }

  if (summary === 'not-required') {
    return (
      <button
        onClick={e => { e.stopPropagation(); onLink(); }}
        title={rec?.appointment.notRequired ? `${rec.appointment.notRequired.reason} — click to link an appointment after all` : 'Click to link an appointment'}
        className={`inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[10px] font-semibold border whitespace-nowrap hover:opacity-80 transition-opacity ${meta.cls}`}
      >
        <CalendarX2 className="w-3 h-3" />
        {meta.label}
      </button>
    );
  }

  return (
    <span
      title={summary === 'mapping-incomplete' ? 'Patient, dentist or practice could not be mapped — resolve it in the case' : undefined}
      className={`inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[10px] font-semibold border whitespace-nowrap ${meta.cls}`}
    >
      {busy && <Loader2 className="w-2.5 h-2.5 animate-spin" />}
      {summary === 'mapping-incomplete' && <Lock className="w-2.5 h-2.5" />}
      {meta.label}
    </span>
  );
}
