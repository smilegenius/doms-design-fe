import { useEffect, useState } from 'react';
import {
  Plug, ChevronDown, ChevronUp, Loader2, CalendarCheck2, CalendarX2, CalendarClock, CalendarPlus,
  Lock, Truck, Send, ScrollText, Pencil, User, Stethoscope, MapPin, Sparkles, PackageCheck, Check,
} from 'lucide-react';
import type { CaseCareStack, CaseLike, EntityMapping, CareStackLogEntry } from '../../data/carestack';
import {
  appointmentById, ensureCaseValidation, formatAppointmentTime, formatStamp, locationById, providerById,
  simulateDigestSend, useCareStackLog, useCaseCareStack, SUMMARY_META, summariseCase,
} from '../../data/carestack';
import { CS_CURRENT_USER, LogOutcomeIcon, MAPPING_LABEL, MAPPING_PILL, MappingIcon, primaryBtn, secondaryBtn } from './shared';
import CorrectDetailsModal from './CorrectDetailsModal';
import AddAppointmentModal from './AddAppointmentModal';
import AppointmentNotRequiredModal from './AppointmentNotRequiredModal';

// ─── CareStack Integration section (Case Details) ───────────────────────────
// Shown on every case while the group's CareStack integration is on. Three
// parts: the entity mapping (Patient / Dentist / Practice), the CareStack
// appointment (searching · linked · required · not required · blocked while
// mapping is incomplete) and the timestamped sync log. Practice-side actions
// (correct details, add appointment, not required) live here; lab-side
// milestones arrive through the store from the status flow.

export default function CareStackCaseSection({
  caseData, onRequestShipmentDetails, onMarkReceived, currentUser = CS_CURRENT_USER,
}: {
  caseData: CaseLike;
  onRequestShipmentDetails?: () => void;
  /** "Mark as Received" — the practice confirms the lab work arrived. */
  onMarkReceived?: () => void;
  currentUser?: string;
}) {
  const record = useCaseCareStack(caseData.id);
  const log = useCareStackLog(caseData.id);
  const summary = summariseCase(record);

  // Collapsed by default once the case is settled (linked / not required);
  // open while something needs the user's attention.
  const settled = summary === 'linked' || summary === 'not-required';
  const [open, setOpen] = useState(!settled);
  const [logOpen, setLogOpen] = useState(false);
  const [correct, setCorrect] = useState<'patient' | 'dentist' | null>(null);
  const [addOpen, setAddOpen] = useState(false);
  const [notReqOpen, setNotReqOpen] = useState(false);

  useEffect(() => { ensureCaseValidation(caseData); }, [caseData.id]); // eslint-disable-line react-hooks/exhaustive-deps

  const rec: CaseCareStack = record ?? {
    caseId: caseData.id,
    patient: { status: 'idle' }, dentist: { status: 'idle' }, practice: { status: 'idle' },
    appointment: { state: 'blocked' },
  };
  const meta = SUMMARY_META[summary];
  const shipmentPending = caseData.status === 'shipped' && !rec.shipment;
  const awaitingReceipt = caseData.status === 'shipped' && !rec.receipt;

  return (
    <div className="bg-white border border-[#E0E0E6] rounded-xl">
      {/* Header */}
      <button
        onClick={() => setOpen(v => !v)}
        className="w-full px-5 py-3.5 flex items-center gap-3 text-left"
      >
        <span className="w-8 h-8 rounded-lg bg-[#ECFEFF] text-[#0F766E] flex items-center justify-center flex-shrink-0">
          <Plug className="w-4 h-4" />
        </span>
        <div className="min-w-0 flex-1">
          <p className="text-sm font-bold text-[#030213] leading-tight">CareStack Integration</p>
          <p className="hidden sm:block text-[11px] text-[#717182] mt-0.5">Enabled by Smile Genius Group · patient, provider and appointment sync for this case</p>
        </div>
        <div className="hidden sm:flex items-center gap-1.5 flex-wrap justify-end">
          {(['patient', 'dentist', 'practice'] as const).map(k => (
            <span key={k} className={`inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[10px] font-semibold border ${MAPPING_PILL[rec[k].status]}`}>
              {k === 'patient' ? 'Patient' : k === 'dentist' ? 'Dentist' : 'Practice'} · {MAPPING_LABEL[rec[k].status]}
            </span>
          ))}
        </div>
        <span className={`inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[10px] font-semibold border whitespace-nowrap ${meta.cls}`}>
          {(summary === 'checking' || summary === 'searching') && <Loader2 className="w-2.5 h-2.5 animate-spin" />}
          {meta.label}
        </span>
        {open ? <ChevronUp className="w-4 h-4 text-[#A0A0B0] flex-shrink-0" /> : <ChevronDown className="w-4 h-4 text-[#A0A0B0] flex-shrink-0" />}
      </button>

      {open && (
        <div className="border-t border-[#F0EFF6] px-5 py-4 space-y-5">
          {/* ── Mapping ── */}
          <div>
            <p className="text-[10px] font-bold text-[#A0A0B0] uppercase tracking-widest mb-2.5">Mapping</p>
            <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
              <EntityRow
                icon={<User className="w-3.5 h-3.5" />}
                label="Patient"
                value={caseData.patientName}
                sub={rec.patient.status === 'matched' ? rec.patient.csLabel : undefined}
                mapping={rec.patient}
                onCorrect={() => setCorrect('patient')}
              />
              <EntityRow
                icon={<Stethoscope className="w-3.5 h-3.5" />}
                label="Dentist"
                value={caseData.dentist}
                sub={rec.dentist.status === 'matched' ? `CareStack provider ${rec.dentist.csId}` : undefined}
                mapping={rec.dentist}
                onCorrect={() => setCorrect('dentist')}
              />
              <EntityRow
                icon={<MapPin className="w-3.5 h-3.5" />}
                label="Practice"
                value={caseData.practice}
                sub={rec.practice.status === 'matched' ? `CareStack location ${rec.practice.csId}` : undefined}
                mapping={rec.practice}
                dsoManaged
              />
            </div>
          </div>

          {/* ── Appointment ── */}
          <div>
            <p className="text-[10px] font-bold text-[#A0A0B0] uppercase tracking-widest mb-2.5">CareStack Appointment</p>
            <AppointmentPanel
              rec={rec}
              caseData={caseData}
              onAdd={() => setAddOpen(true)}
              onNotRequired={() => setNotReqOpen(true)}
            />
          </div>

          {/* ── Shipment prompt (case is Shipped, no details yet) ── */}
          {shipmentPending && onRequestShipmentDetails && (
            <div className="rounded-xl border border-[#BFDBFE] bg-[#EEF4FF] px-4 py-3 flex items-center gap-2.5 flex-wrap">
              <span className="w-6 h-6 rounded-lg bg-white text-[#1565C0] flex items-center justify-center flex-shrink-0 border border-[#BFDBFE]">
                <Truck className="w-3.5 h-3.5" />
              </span>
              <p className="text-xs font-semibold text-[#1565C0] flex-1 min-w-0">Shipment details pending — add the courier and tracking so the practice can follow the delivery.</p>
              <button onClick={onRequestShipmentDetails} className={secondaryBtn}><Truck className="w-3.5 h-3.5" />Add shipment details</button>
            </div>
          )}

          {/* ── Receipt — shipped and not yet confirmed by the practice ── */}
          {awaitingReceipt && onMarkReceived && (
            <div className="rounded-xl border border-[#E0E0E6] bg-[#F8F9FC] px-4 py-3 flex items-center gap-2.5 flex-wrap">
              <span className="w-6 h-6 rounded-lg bg-white text-[#5A5568] flex items-center justify-center flex-shrink-0 border border-[#E0E0E6]">
                <PackageCheck className="w-3.5 h-3.5" />
              </span>
              <div className="flex-1 min-w-0">
                <p className="text-xs font-semibold text-[#030213]">Lab work on its way — confirm when it arrives at the practice.</p>
                <p className="text-[10px] text-[#717182] mt-0.5">Receipt is recorded with date/time and the confirming user{rec.appointment.state === 'linked' ? ', and noted on the CareStack appointment' : ''}.</p>
              </div>
              <button onClick={onMarkReceived} className={primaryBtn}><Check className="w-3.5 h-3.5" />Mark as Received</button>
            </div>
          )}
          {rec.receipt && (
            <div className="rounded-xl border border-[#BBF7D0] bg-[#F0FDF4] px-4 py-3 flex items-start gap-2.5">
              <span className="w-6 h-6 rounded-lg bg-[#DCFCE7] text-[#15803D] flex items-center justify-center flex-shrink-0 mt-0.5">
                <PackageCheck className="w-3.5 h-3.5" />
              </span>
              <div className="min-w-0">
                <p className="text-xs font-bold text-[#166534]">Received by practice</p>
                <p className="text-[11px] text-[#15803D] mt-0.5">{formatStamp(rec.receipt.receivedAt)} · confirmed by {rec.receipt.receivedBy}{rec.receipt.notes ? ` · ${rec.receipt.notes}` : ''}</p>
              </div>
            </div>
          )}

          {/* ── Sync log ── */}
          <div className="border border-[#F0EFF6] rounded-xl overflow-hidden">
            <button onClick={() => setLogOpen(v => !v)} className="w-full flex items-center gap-2 px-4 py-2.5 bg-[#F8F9FC] text-left">
              <ScrollText className="w-3.5 h-3.5 text-[#717182]" />
              <span className="text-xs font-semibold text-[#030213]">CareStack sync log</span>
              <span className="text-[10px] text-[#A0A0B0]">· {log.length} {log.length === 1 ? 'entry' : 'entries'} · timestamped, auditable</span>
              <span className="ml-auto">{logOpen ? <ChevronUp className="w-3.5 h-3.5 text-[#A0A0B0]" /> : <ChevronDown className="w-3.5 h-3.5 text-[#A0A0B0]" />}</span>
            </button>
            {logOpen && (
              <div className="divide-y divide-[#F0EFF6]">
                {log.length === 0 && <p className="text-xs text-[#A0A0B0] italic text-center py-6">Nothing synchronised yet.</p>}
                {[...log].reverse().map(e => (
                  <LogRow key={e.id} entry={e} digestPending={!!rec.digest && !rec.digest.sentAt && e.outcome === 'queued'} onSendDigest={() => simulateDigestSend(caseData.id)} />
                ))}
              </div>
            )}
          </div>
        </div>
      )}

      {correct && (
        <CorrectDetailsModal
          caseData={caseData}
          entity={correct}
          mapping={rec[correct]}
          onClose={() => setCorrect(null)}
          currentUser={currentUser}
        />
      )}
      {addOpen && <AddAppointmentModal caseData={caseData} record={rec} onClose={() => setAddOpen(false)} currentUser={currentUser} />}
      {notReqOpen && <AppointmentNotRequiredModal caseData={caseData} onClose={() => setNotReqOpen(false)} currentUser={currentUser} />}
    </div>
  );
}

// ─── Pieces ──────────────────────────────────────────────────────────────────

function EntityRow({
  icon, label, value, sub, mapping, onCorrect, dsoManaged,
}: {
  icon: React.ReactNode;
  label: string;
  value: string;
  sub?: string;
  mapping: EntityMapping;
  onCorrect?: () => void;
  dsoManaged?: boolean;
}) {
  const failed = mapping.status === 'not-found';
  return (
    <div className={`rounded-xl border px-3.5 py-3 ${failed ? 'border-[#FECACA] bg-[#FFF7F7]' : 'border-[#E0E0E6] bg-white'}`}>
      <div className="flex items-start gap-2.5">
        <span className="w-7 h-7 rounded-lg bg-[#F3F3F5] text-[#717182] flex items-center justify-center flex-shrink-0">{icon}</span>
        <div className="min-w-0 flex-1">
          <p className="text-[10px] text-[#A0A0B0] uppercase tracking-wider font-semibold">{label}</p>
          <p className="text-xs font-semibold text-[#030213] truncate" title={value}>{value}</p>
          {sub && <p className="text-[10px] text-[#717182] mt-0.5 truncate" title={sub}>{sub}</p>}
        </div>
        <div className="flex items-center gap-1.5 flex-shrink-0">
          <MappingIcon mapping={mapping} entity={label} />
          <span className={`text-[10px] font-semibold ${
            mapping.status === 'matched' ? 'text-[#15803D]' : failed ? 'text-[#B91C1C]' : mapping.status === 'checking' ? 'text-[#1565C0]' : 'text-[#A0A0B0]'
          }`}>
            {MAPPING_LABEL[mapping.status]}
          </span>
        </div>
      </div>
      {mapping.status === 'checking' && (
        <p className="text-[10px] text-[#1565C0] mt-2">Attempting to find this {label.toLowerCase()} in CareStack…</p>
      )}
      {failed && (
        <div className="mt-2">
          {mapping.reason && <p className="text-[10px] text-[#B91C1C] leading-relaxed">{mapping.reason}</p>}
          {dsoManaged ? (
            <p className="text-[10px] text-[#717182] leading-relaxed mt-1.5">
              Practice mapping is managed by your DSO admin — ask them to map <span className="font-semibold">{value}</span> to a CareStack location.
            </p>
          ) : onCorrect ? (
            <button onClick={onCorrect} className={`${secondaryBtn} mt-2`}>
              <Pencil className="w-3 h-3" />Correct details
            </button>
          ) : null}
        </div>
      )}
      {mapping.status === 'matched' && mapping.correctedBy && (
        <p className="text-[10px] text-[#A0A0B0] mt-2">Corrected by {mapping.correctedBy} · {formatStamp(mapping.correctedAt)}</p>
      )}
    </div>
  );
}

function AppointmentPanel({
  rec, caseData, onAdd, onNotRequired,
}: {
  rec: CaseCareStack;
  caseData: CaseLike;
  onAdd: () => void;
  onNotRequired: () => void;
}) {
  const a = rec.appointment;
  const mapped = [rec.patient, rec.dentist, rec.practice].every(m => m.status === 'matched');
  const checking = [rec.patient, rec.dentist, rec.practice].some(m => m.status === 'checking' || m.status === 'idle');

  if (a.state === 'linked' && a.appointmentId) {
    const appt = appointmentById(a.appointmentId);
    const provider = providerById(appt?.providerId);
    const loc = locationById(appt?.locationId);
    return (
      <div className="rounded-xl border border-[#BBF7D0] bg-[#F0FDF4] px-4 py-3">
        <div className="flex items-start gap-2.5">
          <span className="w-6 h-6 rounded-lg bg-[#DCFCE7] text-[#15803D] flex items-center justify-center flex-shrink-0 mt-0.5">
            <CalendarCheck2 className="w-3.5 h-3.5" />
          </span>
          <div className="min-w-0 flex-1">
            <p className="text-xs font-bold text-[#166534] flex items-center gap-2 flex-wrap">
              Linked
              <span className="font-mono font-medium text-[#15803D]">{a.appointmentId}</span>
              {a.createdBySg && (
                <span className="inline-flex items-center gap-1 px-1.5 py-0.5 rounded-full text-[9px] font-bold uppercase tracking-wider bg-white text-[#0F766E] border border-[#99F6E4]">
                  <Sparkles className="w-2.5 h-2.5" />Created by Smile Genius
                </span>
              )}
            </p>
            <div className="grid grid-cols-1 sm:grid-cols-3 gap-x-4 gap-y-1.5 mt-2">
              <Kv label="Date / time" value={appt ? formatAppointmentTime(appt.startsAt) : '—'} />
              <Kv label="Dentist" value={provider?.name ?? caseData.dentist} />
              <Kv label="Practice" value={loc?.name ?? caseData.practice} />
            </div>
            <p className="text-[10px] text-[#4D7C5A] mt-2">
              {appt?.type ? `${appt.type} · ` : ''}Linked by {a.linkedBy} · {formatStamp(a.linkedAt)} · lab-work updates post to this appointment as notes
            </p>
          </div>
        </div>
      </div>
    );
  }

  if (a.state === 'not-required' && a.notRequired) {
    return (
      <div className="rounded-xl border border-[#E0E0E6] bg-[#F8F9FC] px-4 py-3 flex items-start gap-2.5">
        <span className="w-6 h-6 rounded-lg bg-[#EDEBF2] text-[#5A5568] flex items-center justify-center flex-shrink-0 mt-0.5">
          <CalendarX2 className="w-3.5 h-3.5" />
        </span>
        <div className="min-w-0 flex-1">
          <p className="text-xs font-bold text-[#030213]">Appointment Not Required</p>
          <p className="text-[11px] text-[#5A5568] leading-relaxed mt-0.5">Reason: {a.notRequired.reason}</p>
          <p className="text-[10px] text-[#A0A0B0] mt-1">{a.notRequired.by} · {formatStamp(a.notRequired.at)} · no CareStack appointment will be created or updated for this case</p>
        </div>
      </div>
    );
  }

  if (a.state === 'searching') {
    return (
      <div className="rounded-xl border border-[#BFDBFE] bg-[#EEF4FF] px-4 py-3 flex items-center gap-2.5">
        <Loader2 className="w-4 h-4 text-[#4D8EF7] animate-spin flex-shrink-0" />
        <div className="min-w-0">
          <p className="text-xs font-bold text-[#1565C0]">Finding appointment…</p>
          <p className="text-[11px] text-[#3B6BAE] leading-relaxed mt-0.5">Searching CareStack for an appointment matching the mapped patient, provider and location. The case keeps moving through the lab workflow meanwhile.</p>
        </div>
      </div>
    );
  }

  if (a.state === 'required') {
    const digest = rec.digest;
    return (
      <div className="rounded-xl border border-[#FDE68A] bg-[#FFF8E1] px-4 py-3">
        <div className="flex items-start gap-2.5">
          <span className="w-6 h-6 rounded-lg bg-[#FEF3C7] text-[#B45309] flex items-center justify-center flex-shrink-0 mt-0.5">
            <CalendarClock className="w-3.5 h-3.5" />
          </span>
          <div className="min-w-0 flex-1">
            <p className="text-xs font-bold text-[#92400E]">Appointment Required</p>
            <p className="text-[11px] text-[#A16207] leading-relaxed mt-0.5">
              {a.requiredReason === 'ambiguous'
                ? 'More than one possible CareStack appointment was found, so none was selected automatically. Link the right one, create a new one, or mark the case as not needing an appointment.'
                : 'Smile Genius could not find a matching CareStack appointment. Link an existing appointment, create a new one, or mark the case as not needing an appointment. Lab processing is not blocked.'}
            </p>
            {digest && (
              <p className="text-[10px] text-[#A16207] mt-1.5 inline-flex items-center gap-1">
                <Send className="w-3 h-3" />
                {digest.sentAt ? `Practice notified · ${formatStamp(digest.sentAt)}` : `Practice notification queued for the end-of-day digest · queued ${formatStamp(digest.queuedAt)}`}
              </p>
            )}
            <div className="flex items-center gap-2 flex-wrap mt-3">
              <button onClick={onAdd} className={primaryBtn}><CalendarPlus className="w-3.5 h-3.5" />Add Appointment</button>
              <button onClick={onNotRequired} className={secondaryBtn}><CalendarX2 className="w-3.5 h-3.5" />Appointment Not Required</button>
            </div>
          </div>
        </div>
      </div>
    );
  }

  // blocked — mapping incomplete or still running
  return (
    <div className={`rounded-xl border px-4 py-3 flex items-start gap-2.5 ${checking && !mapped ? 'border-[#E0E0E6] bg-[#F8F9FC]' : 'border-[#FDE68A] bg-[#FFF8E1]'}`}>
      <span className={`w-6 h-6 rounded-lg flex items-center justify-center flex-shrink-0 mt-0.5 ${checking && !mapped ? 'bg-[#EDEBF2] text-[#717182]' : 'bg-[#FEF3C7] text-[#B45309]'}`}>
        <Lock className="w-3.5 h-3.5" />
      </span>
      <div className="min-w-0">
        <p className={`text-xs font-bold ${checking && !mapped ? 'text-[#5A5568]' : 'text-[#92400E]'}`}>
          {checking && !mapped ? 'Waiting for mapping' : 'Appointment functionality unavailable until mapping is completed'}
        </p>
        <p className={`text-[11px] leading-relaxed mt-0.5 ${checking && !mapped ? 'text-[#717182]' : 'text-[#A16207]'}`}>
          {checking && !mapped
            ? 'The appointment lookup starts automatically once the patient, dentist and practice are matched in CareStack.'
            : 'The patient, dentist and practice must all be matched in CareStack before an appointment can be found, linked or created. Correct the details above to continue. Lab processing is not blocked.'}
        </p>
      </div>
    </div>
  );
}

function Kv({ label, value }: { label: string; value: string }) {
  return (
    <div className="min-w-0">
      <p className="text-[10px] text-[#4D7C5A]/80 uppercase tracking-wider font-semibold">{label}</p>
      <p className="text-xs font-semibold text-[#14532D] truncate" title={value}>{value}</p>
    </div>
  );
}

function LogRow({ entry, digestPending, onSendDigest }: { entry: CareStackLogEntry; digestPending: boolean; onSendDigest: () => void }) {
  const [expanded, setExpanded] = useState(false);
  return (
    <div className="px-4 py-2.5 flex items-start gap-2.5">
      <LogOutcomeIcon outcome={entry.outcome} />
      <div className="min-w-0 flex-1">
        <p className="text-xs text-[#030213] leading-relaxed">{entry.text}</p>
        <p className="text-[10px] text-[#A0A0B0] mt-0.5 flex items-center gap-2 flex-wrap">
          <span className="tabular-nums">{formatStamp(entry.at)}</span>
          {entry.by && <span>· {entry.by}</span>}
          <span className="uppercase tracking-wider font-semibold">· {entry.kind.replace('-', ' ')}</span>
          {entry.detail && (
            <button onClick={() => setExpanded(v => !v)} className="text-[#4D8EF7] font-semibold hover:underline">
              {expanded ? 'Hide' : 'View'} {entry.kind === 'email' ? 'email' : entry.kind === 'note' ? 'note' : 'details'}
            </button>
          )}
          {digestPending && (
            <button onClick={onSendDigest} className="text-[#B45309] font-semibold hover:underline">Send digest now (demo)</button>
          )}
        </p>
        {expanded && entry.detail && (
          <pre className="mt-2 text-[11px] text-[#5A5568] whitespace-pre-wrap font-sans leading-relaxed bg-[#F8F9FC] border border-[#F0EFF6] rounded-lg px-3 py-2">{entry.detail}</pre>
        )}
      </div>
    </div>
  );
}
