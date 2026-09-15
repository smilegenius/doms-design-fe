import { useMemo, useState } from 'react';
import { Link2, CalendarPlus, CheckCircle2, ArrowLeft, MapPin, Stethoscope, CalendarClock } from 'lucide-react';
import Modal from '../Modal';
import { useToast } from '../../context/ToastContext';
import type { CaseCareStack, CaseLike } from '../../data/carestack';
import {
  APPOINTMENT_TYPES, createAndLinkAppointment, ensureDemoAppointments, formatAppointmentTime,
  linkExistingAppointment, locationById, mappedActiveProviders, providerById, rankByDueDate,
} from '../../data/carestack';
import { CS_CURRENT_USER, ghostBtn, inputCls, labelCls, primaryBtn, todayIso, dmyToIso } from './shared';

type Step = 'link' | 'create';

// "Link Appointment" — opens straight onto the patient's CareStack
// appointments (nearest to the case due date first, suggested one
// preselected). Creating a new appointment in CareStack is the secondary
// path, reached from inside the same modal.
export default function AddAppointmentModal({
  caseData, record, onClose, currentUser = CS_CURRENT_USER, initialStep = 'link',
}: {
  caseData: CaseLike;
  record: CaseCareStack;
  onClose: () => void;
  currentUser?: string;
  initialStep?: Step;
}) {
  const { toast } = useToast();
  const [step, setStep] = useState<Step>(initialStep);
  const candidates = new Set(record.appointment.candidateIds ?? []);
  const currentId = record.appointment.state === 'linked' ? record.appointment.appointmentId : undefined;
  // Nearest to the due date first; the lookup's suggestion (or, failing that,
  // the nearest) starts selected — the user still has to press Link. Patients
  // with nothing on file get a few example slots so there is always a list.
  const existing = useMemo(
    () => rankByDueDate(ensureDemoAppointments(caseData, record), caseData.requestedDelivery),
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [record.patient.csId, record.dentist.csId, record.practice.csId, caseData.id, caseData.requestedDelivery],
  );
  const nearestId = existing[0]?.id;
  const [pickedId, setPickedId] = useState<string | null>(record.appointment.suggestedId ?? (existing.length ? nearestId : null));
  const location = locationById(record.practice.csId);
  const providers = useMemo(() => mappedActiveProviders(location?.id), [location?.id]);

  const [date, setDate] = useState(dmyToIso(caseData.requestedDelivery) || todayIso());
  const [time, setTime] = useState('10:00');
  const [providerId, setProviderId] = useState(record.dentist.csId ?? providers[0]?.id ?? '');
  const [type, setType] = useState(APPOINTMENT_TYPES[0]);

  const link = () => {
    if (!pickedId) return;
    linkExistingAppointment(caseData, pickedId, currentUser);
    toast.success(`Appointment ${pickedId} linked to ${caseData.id}`);
    onClose();
  };
  const create = () => {
    if (!date || !time || !providerId || !location) return;
    const appt = createAndLinkAppointment(caseData, { date, time, providerId, locationId: location.id, type }, currentUser);
    toast.success(`Appointment ${appt.id} created in CareStack and linked to ${caseData.id}`);
    onClose();
  };

  return (
    <Modal zIndex="z-[120]"
      isOpen
      onClose={onClose}
      title={step === 'link' ? (currentId ? 'Change Appointment' : 'Link Appointment') : 'Create New Appointment'}
      size="lg"
      footer={
        step === 'link' ? (
          <>
            <button onClick={() => setStep('create')} className="mr-auto inline-flex items-center gap-1 text-xs font-semibold text-[#4D8EF7] hover:underline">
              <CalendarPlus className="w-3.5 h-3.5" />Create a new appointment instead
            </button>
            <button onClick={onClose} className={ghostBtn}>Cancel</button>
            <button onClick={link} disabled={!pickedId || pickedId === currentId} className={primaryBtn}><Link2 className="w-3.5 h-3.5" />Link appointment</button>
          </>
        ) : (
          <>
            <button onClick={() => setStep('link')} className="mr-auto inline-flex items-center gap-1 text-xs font-semibold text-[#4D8EF7] hover:underline">
              <ArrowLeft className="w-3.5 h-3.5" />Back to existing appointments
            </button>
            <button onClick={onClose} className={ghostBtn}>Cancel</button>
            <button onClick={create} disabled={!date || !time || !providerId} className={primaryBtn}><CalendarPlus className="w-3.5 h-3.5" />Create &amp; link in CareStack</button>
          </>
        )
      }
    >
      {/* Context strip — who / where this appointment is for */}
      <div className="flex flex-wrap items-center gap-x-4 gap-y-1 text-[11px] text-[#5A5568] mb-4">
        <span><span className="text-[#A0A0B0]">Patient</span> <span className="font-semibold text-[#030213]">{caseData.patientName}</span> <span className="font-mono text-[#A0A0B0]">{record.patient.csId}</span></span>
        <span className="inline-flex items-center gap-1"><Stethoscope className="w-3 h-3 text-[#A0A0B0]" />{caseData.dentist}</span>
        <span className="inline-flex items-center gap-1"><MapPin className="w-3 h-3 text-[#A0A0B0]" />{location?.name ?? caseData.practice}</span>
        <span className="inline-flex items-center gap-1"><CalendarClock className="w-3 h-3 text-[#A0A0B0]" />Case due {caseData.requestedDelivery ?? 'not set'}</span>
      </div>

      {step === 'link' && (
        <div className="space-y-3">
          {record.appointment.requiredReason === 'ambiguous' && (
            <p className="text-[11px] text-[#B45309] bg-[#FFF8E1] border border-[#FDE68A] rounded-lg px-3 py-2">
              Smile Genius found more than one possible appointment and did not pick one automatically. The one nearest to the case due date is suggested — confirm it or choose another.
            </p>
          )}
          <div className="border border-[#E0E0E6] rounded-xl overflow-hidden divide-y divide-[#F0EFF6]">
            {existing.length === 0 && (
              <p className="text-xs text-[#A0A0B0] italic text-center py-8">No CareStack appointments on file for this patient — create one instead.</p>
            )}
            {existing.map(a => {
              const active = pickedId === a.id;
              const provider = providerById(a.providerId);
              const loc = locationById(a.locationId);
              const isCurrent = a.id === currentId;
              return (
                <button
                  key={a.id}
                  onClick={() => setPickedId(a.id)}
                  className={`w-full flex items-center gap-3 px-4 py-3 text-left transition-colors ${active ? 'bg-[#EEF4FF]' : 'hover:bg-[#F8F9FC]'}`}
                >
                  {active ? <CheckCircle2 className="w-4 h-4 text-[#4D8EF7] flex-shrink-0" /> : <span className="w-4 h-4 rounded-full border border-[#D4CEE1] flex-shrink-0" />}
                  <div className="min-w-0 flex-1">
                    <p className="text-xs font-semibold text-[#030213] flex items-center gap-2 flex-wrap">
                      {formatAppointmentTime(a.startsAt)}
                      <span className="text-[10px] font-medium text-[#717182]">{a.type} · {a.durationMin} min</span>
                      {a.id === nearestId && (
                        <span className="inline-flex px-1.5 py-0.5 rounded-full text-[9px] font-bold uppercase tracking-wider bg-[#ECFEFF] text-[#0F766E] border border-[#99F6E4]">Nearest to due date</span>
                      )}
                      {candidates.has(a.id) && a.id !== nearestId && (
                        <span className="inline-flex px-1.5 py-0.5 rounded-full text-[9px] font-bold uppercase tracking-wider bg-[#FFF8E1] text-[#B45309] border border-[#FDE68A]">Possible match</span>
                      )}
                      {isCurrent && (
                        <span className="inline-flex px-1.5 py-0.5 rounded-full text-[9px] font-bold uppercase tracking-wider bg-[#F0FDF4] text-[#15803D] border border-[#BBF7D0]">Currently linked</span>
                      )}
                    </p>
                    <p className="text-[11px] text-[#717182] mt-0.5">{provider?.name ?? a.providerId} · {loc?.name ?? a.locationId} · <span className="font-mono">{a.id}</span></p>
                  </div>
                </button>
              );
            })}
          </div>
        </div>
      )}

      {step === 'create' && (
        <div className="space-y-4">
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
            <div>
              <label className={labelCls}>Date</label>
              <input type="date" value={date} onChange={e => setDate(e.target.value)} className={inputCls} />
            </div>
            <div>
              <label className={labelCls}>Time</label>
              <input type="time" value={time} onChange={e => setTime(e.target.value)} className={inputCls} />
            </div>
            <div>
              <label className={labelCls}>Provider</label>
              <select value={providerId} onChange={e => setProviderId(e.target.value)} className={inputCls}>
                {providers.map(p => <option key={p.id} value={p.id}>{p.name} · {p.id}</option>)}
              </select>
              <p className="text-[10px] text-[#A0A0B0] mt-1">Active, mapped CareStack providers only.</p>
            </div>
            <div>
              <label className={labelCls}>Appointment type</label>
              <select value={type} onChange={e => setType(e.target.value)} className={inputCls}>
                {APPOINTMENT_TYPES.map(t => <option key={t} value={t}>{t}</option>)}
              </select>
            </div>
            <div className="sm:col-span-2">
              <label className={labelCls}>Location</label>
              <span className="inline-flex items-center gap-1.5 px-2.5 py-1.5 rounded-lg text-xs font-semibold bg-[#F3F3F5] text-[#5A5568] border border-[#E0E0E6]">
                <MapPin className="w-3 h-3" />{location?.name ?? caseData.practice}
                <span className="font-mono text-[#A0A0B0]">{location?.id}</span>
              </span>
            </div>
          </div>
          <p className="text-[11px] text-[#5A5568] leading-relaxed bg-[#F8F9FC] border border-[#F0EFF6] rounded-lg px-3 py-2">
            Smile Genius will create this appointment in CareStack using the mapped Patient, Provider and Location IDs, then link it to {caseData.id}.
          </p>
        </div>
      )}
    </Modal>
  );
}
