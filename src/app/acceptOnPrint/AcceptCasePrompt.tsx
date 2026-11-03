// ─── Accept case on print · the prompt ───────────────────────────────────────
// [Lab] Pressing Print on the Smile Genius order form always asks first, so labs
// start moving statuses on. Every lab, every case; the PM's copy per scenario:
//   • Postal, received, not accepted / Digital, not accepted — "Do you have
//     everything needed to process this case?" → Accept & print.
//   • Postal, not marked received — "Has the parcel arrived, and do you have
//     everything needed to process this case?" → Mark received, accept & print.
//   • Already accepted (or moved past Accepted) — "Print the order form?" → Print form.
// A case not yet accepted also has Something missing: the lab says what, and the
// case goes On Hold.

import { useState } from 'react';
import { AlertTriangle, ArrowLeft, Check, CheckCircle2, Clock, Package, Printer, X } from 'lucide-react';
import ModalPortal from '../components/ModalPortal';
import { useToast } from '../context/ToastContext';
import { LabStatusChip, shortWhen } from './labStatus';
import {
  MISSING_OPTIONS, acceptCase, awaitingReceipt, getLabCase, isAccepted, isPosted, putOnHold, useLabCases, type LabCase,
} from './store';

/** "2026-10-31" → "Sat 31 Oct" */
const postedDay = (iso: string) => {
  const [y, m, d] = iso.split('-').map(Number);
  return new Date(y, m - 1, d).toLocaleDateString('en-GB', { weekday: 'short', day: 'numeric', month: 'short' });
};

const teethText = (c: LabCase) => (c.fdi.length ? ` · ${c.fdi.join(', ')}` : '');

/**
 * The order form's Print, gated: `print(id)` opens the prompt for that case (an accepted one only confirms the
 * print). Render `dialog` once, anywhere on the page.
 */
export function useOrderFormPrint() {
  const cases = useLabCases();
  const [asking, setAsking] = useState<string | null>(null);
  const c = asking ? cases.find(x => x.id === asking) : undefined;

  const print = (id: string) => { if (getLabCase(id)) setAsking(id); };
  const dialog = c ? <AcceptCasePrompt c={c} onClose={() => setAsking(null)} /> : null;
  return { print, dialog };
}

/**
 * The prompt. It opens on the accept question; `start="missing"` opens straight on Something missing (the lab
 * picked On Hold from the status list), where Back cancels.
 */
export default function AcceptCasePrompt({ c, onClose, start = 'accept' }: { c: LabCase; onClose: () => void; start?: 'accept' | 'missing' }) {
  const { toast } = useToast();
  const [step, setStep] = useState<'accept' | 'missing'>(start);
  const [missing, setMissing] = useState<string[]>(c.hold?.missing ?? []);
  const [note, setNote] = useState('');
  // Read once when the prompt opens: accepting changes the case under it before it closes.
  const [accepted] = useState(() => isAccepted(c));
  const [toReceive] = useState(() => awaitingReceipt(c));
  const posted = isPosted(c);
  const options = posted ? MISSING_OPTIONS.post : MISSING_OPTIONS.digital;
  const needsNote = missing.includes('Other') && !note.trim();
  const canHold = missing.length > 0 && !needsNote;
  const question = accepted ? 'Print the order form?'
    : toReceive ? 'Has the parcel arrived, and do you have everything needed to process this case?'
    : 'Do you have everything needed to process this case?';
  const primary = accepted ? 'Print form' : toReceive ? 'Mark received, accept & print' : 'Accept & print';

  const confirm = () => {
    if (accepted) {
      toast.success(`Printing the order form for ${c.id}…`);
    } else {
      acceptCase(c.id);
      toast.success(`${c.id} ${toReceive ? 'marked as received and accepted' : 'accepted'}. Printing the order form…`);
    }
    onClose();
  };
  const hold = () => {
    if (!canHold) return;
    putOnHold(c.id, missing, note);
    toast.info(`${c.id} is on hold. ${c.practice} has been asked for: ${missing.join(', ')}.`);
    onClose();
  };
  const toggle = (m: string) => setMissing(prev => (prev.includes(m) ? prev.filter(x => x !== m) : [...prev, m]));

  return (
    <ModalPortal>
      <div className="fixed inset-0 z-[120] flex items-center justify-center p-4">
        <div className="absolute inset-0 bg-black/40 backdrop-blur-[2px]" onClick={onClose} />
        <div role="dialog" aria-modal="true" aria-label={step === 'accept' ? question : 'What’s missing?'} className="relative bg-white rounded-2xl shadow-2xl w-full max-w-[640px] max-h-[90vh] overflow-y-auto animate-in fade-in zoom-in-95 duration-150">
          <button onClick={onClose} aria-label="Close" className="absolute top-4 right-4 w-8 h-8 rounded-lg hover:bg-[#F8F9FC] flex items-center justify-center text-[#717182] transition-colors">
            <X className="w-4 h-4" />
          </button>

          {step === 'accept' ? (
            <>
              <div className="px-6 pt-6 space-y-4">
                <div className="flex items-center gap-3 pr-8">
                  <span className="w-10 h-10 rounded-xl bg-[#EEF4FF] flex items-center justify-center flex-shrink-0">
                    <Printer className="w-5 h-5 text-[#4D8EF7]" />
                  </span>
                  <h3 className="text-base font-semibold text-[#030213] leading-snug">{question}</h3>
                </div>

                <CaseCard c={c} />

                {toReceive && c.via.kind === 'post' && (
                  <div className="flex items-start gap-2.5 px-3.5 py-3 rounded-xl bg-[#FFF8E1] border border-[#FDE68A]">
                    <span className="w-7 h-7 rounded-lg bg-[#FDE68A]/70 flex items-center justify-center flex-shrink-0">
                      <Package className="w-3.5 h-3.5 text-[#A16207]" />
                    </span>
                    <div className="min-w-0">
                      <p className="text-[10px] font-bold text-[#A16207] uppercase tracking-wider">Sent by post · not marked as received</p>
                      <p className="text-[11px] text-[#7A5C0E] leading-snug mt-0.5">
                        {c.via.courier} · {c.via.tracking} · posted {postedDay(c.via.postedOn)}
                      </p>
                    </div>
                  </div>
                )}

                {!accepted && c.status === 'On Hold' && c.hold && (
                  <div className="flex items-start gap-2.5 px-3.5 py-3 rounded-xl bg-[#FFF1F2] border border-[#FECDD3]">
                    <Clock className="w-4 h-4 text-[#BE123C] flex-shrink-0 mt-0.5" />
                    <p className="text-[11px] text-[#9F1239] leading-snug">
                      On hold since {shortWhen(c.hold.at)}. {c.practice} was asked for: {c.hold.missing.join(', ')}.
                    </p>
                  </div>
                )}
              </div>

              <div className="flex flex-wrap items-center justify-end gap-3 px-6 py-5">
                <button onClick={onClose} className={`${accepted ? 'min-w-[120px] bg-[#F3F3F5] hover:bg-[#E9E9EE] text-[#1E1B4B]' : 'mr-auto text-[#717182] hover:text-[#030213]'} px-4 py-3 rounded-xl text-sm font-semibold transition-colors`}>
                  Cancel
                </button>
                {!accepted && (
                  <button
                    onClick={() => setStep('missing')}
                    className="inline-flex items-center justify-center gap-1.5 px-4 py-3 rounded-xl text-sm font-semibold text-[#1E1B4B] bg-[#F3F3F5] hover:bg-[#E9E9EE] transition-colors whitespace-nowrap flex-shrink-0"
                  >
                    <AlertTriangle className="w-4 h-4 flex-shrink-0 text-[#B45309]" />
                    Something missing
                  </button>
                )}
                <button
                  onClick={confirm}
                  autoFocus
                  className="inline-flex items-center justify-center gap-1.5 min-w-[150px] px-5 py-3 rounded-xl text-sm font-semibold text-white bg-gradient-to-r from-[#4D8EF7] to-[#A59DFF] hover:opacity-90 transition-opacity whitespace-nowrap flex-shrink-0"
                >
                  {accepted ? <Printer className="w-4 h-4 flex-shrink-0" /> : <CheckCircle2 className="w-4 h-4 flex-shrink-0" />}
                  {primary}
                </button>
              </div>
            </>
          ) : (
            <>
              <div className="px-6 pt-6 space-y-4">
                <div className="flex items-start gap-3 pr-8">
                  <span className="w-10 h-10 rounded-xl bg-[#FFF1F2] flex items-center justify-center flex-shrink-0">
                    <Clock className="w-5 h-5 text-[#BE123C]" />
                  </span>
                  <div className="min-w-0">
                    <h3 className="text-base font-semibold text-[#030213]">What’s missing?</h3>
                    <p className="text-xs text-[#717182] mt-0.5 leading-relaxed">
                      {c.id} goes On Hold, and {c.practice} is asked for what you pick.
                    </p>
                  </div>
                </div>

                <div className="flex flex-wrap gap-2" role="group" aria-label="What’s missing">
                  {options.map(m => {
                    const on = missing.includes(m);
                    return (
                      <button
                        key={m}
                        type="button"
                        aria-pressed={on}
                        onClick={() => toggle(m)}
                        className={`inline-flex items-center gap-1.5 px-3 py-1.5 rounded-full text-xs font-semibold border transition-colors ${
                          on ? 'bg-[#FFF1F2] border-[#FECDD3] text-[#BE123C]' : 'bg-white border-[#E0E0E6] text-[#5A5568] hover:bg-[#F8F9FC]'
                        }`}
                      >
                        {on && <Check className="w-3 h-3" strokeWidth={3} />}
                        {m}
                      </button>
                    );
                  })}
                </div>

                <div>
                  <label htmlFor="hold-note" className="block text-xs font-semibold text-[#030213] mb-1.5">
                    Message to the practice{' '}
                    <span className="font-normal text-[#A0A0B0]">{missing.includes('Other') ? '(required for Other)' : '(optional)'}</span>
                  </label>
                  <textarea
                    id="hold-note"
                    value={note}
                    onChange={e => setNote(e.target.value)}
                    rows={3}
                    placeholder={posted ? 'e.g. There was no bite registration in the bag.' : 'e.g. Please send a photo with the shade tab.'}
                    className="w-full px-3 py-2 rounded-lg border border-[#E0E0E6] bg-white text-sm text-[#030213] focus:border-[#4D8EF7] focus:outline-none resize-none"
                  />
                </div>
              </div>

              <div className="flex items-center justify-end gap-3 px-6 py-5">
                <button
                  onClick={() => (start === 'missing' ? onClose() : setStep('accept'))}
                  className="inline-flex items-center justify-center gap-1.5 min-w-[120px] px-5 py-3 rounded-xl text-sm font-semibold text-[#1E1B4B] bg-[#F3F3F5] hover:bg-[#E9E9EE] transition-colors"
                >
                  {start === 'missing' ? 'Cancel' : <><ArrowLeft className="w-4 h-4" />Back</>}
                </button>
                <button
                  onClick={hold}
                  disabled={!canHold}
                  className={`inline-flex items-center justify-center gap-1.5 min-w-[160px] px-5 py-3 rounded-xl text-sm font-semibold transition-opacity ${
                    canHold ? 'text-white bg-gradient-to-r from-[#4D8EF7] to-[#A59DFF] hover:opacity-90' : 'text-[#5A5568] bg-[#E0E0E6] cursor-not-allowed'
                  }`}
                >
                  Put on hold
                </button>
              </div>
            </>
          )}
        </div>
      </div>
    </ModalPortal>
  );
}

/** The case being printed: what the lab needs to recognise it. */
function CaseCard({ c }: { c: LabCase }) {
  const posted = c.via.kind === 'post';
  return (
    <div className="rounded-xl border border-[#E0E0E6] bg-[#F8F9FC] px-4 py-3">
      <div className="flex items-center gap-2 flex-wrap">
        <span className="text-sm font-semibold text-[#030213]">{c.id}</span>
        <LabStatusChip status={c.status} />
        {posted && c.receivedAt && (
          <span className="inline-flex items-center gap-1 text-[11px] text-[#717182]">
            <CheckCircle2 className="w-3 h-3 text-[#2E7D32]" />
            Received {shortWhen(c.receivedAt)}
          </span>
        )}
      </div>
      <div className="grid grid-cols-2 gap-x-4 gap-y-2 mt-3">
        <Field label="Patient" value={c.patientName} />
        <Field label="Service" value={`${c.service}${teethText(c)}`} />
        <Field label="Practice" value={`${c.practice} · ${c.dentist}`} />
        <Field label="Due date" value={c.requestedDelivery} />
      </div>
    </div>
  );
}

function Field({ label, value }: { label: string; value: string }) {
  return (
    <div className="min-w-0">
      <p className="text-[10px] text-[#A0A0B0] uppercase tracking-wider font-semibold">{label}</p>
      <p className="text-xs font-semibold text-[#030213] truncate">{value}</p>
    </div>
  );
}
