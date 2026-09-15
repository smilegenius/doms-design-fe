import { useMemo, useState } from 'react';
import { Link2, CalendarPlus, CheckCircle2, ArrowLeft, MapPin, Stethoscope } from 'lucide-react';
import Modal from '../Modal';
import { useToast } from '../../context/ToastContext';
import type { CaseCareStack, CaseLike } from '../../data/carestack';
import {
  APPOINTMENT_TYPES, appointmentsForPatient, createAndLinkAppointment, formatAppointmentTime,
  linkExistingAppointment, locationById, mappedActiveProviders, providerById,
} from '../../data/carestack';
import { CS_CURRENT_USER, ghostBtn, inputCls, labelCls, primaryBtn, todayIso, dmyToIso } from './shared';

type Step = 'choose' | 'link' | 'create';

// "Add Appointment" — the two resolutions the Appointment Required email
// offers: link one that already exists in CareStack, or have Smile Genius
// create one there and link it.
export default function AddAppointmentModal({
  caseData, record, onClose, currentUser = CS_CURRENT_USER,
}: {
  caseData: CaseLike;
  record: CaseCareStack;
  onClose: () => void;
  currentUser?: string;
}) {
  const { toast } = useToast();
  const [step, setStep] = useState<Step>('choose');
  const [pickedId, setPickedId] = useState<string | null>(null);
  const candidates = new Set(record.appointment.candidateIds ?? []);
  const existing = useMemo(() => appointmentsForPatient(record.patient.csId), [record.patient.csId]);
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

  const title = step === 'choose' ? 'Add Appointment' : step === 'link' ? 'Link an Existing Appointment' : 'Create New Appointment';

  return (
    <Modal
      isOpen
      onClose={onClose}
      title={title}
      size="lg"
      footer={
        step === 'choose' ? (
          <button onClick={onClose} className={ghostBtn}>Cancel</button>
        ) : (
          <>
            <button onClick={() => setStep('choose')} className={ghostBtn}><ArrowLeft className="w-3.5 h-3.5" />Back</button>
            {step === 'link'
              ? <button onClick={link} disabled={!pickedId} className={primaryBtn}><Link2 className="w-3.5 h-3.5" />Link appointment</button>
              : <button onClick={create} disabled={!date || !time || !providerId} className={primaryBtn}><CalendarPlus className="w-3.5 h-3.5" />Create &amp; link in CareStack</button>}
          </>
        )
      }
    >
      {/* Context strip — who / where this appointment is for */}
      <div className="flex flex-wrap items-center gap-x-4 gap-y-1 text-[11px] text-[#5A5568] mb-4">
        <span><span className="text-[#A0A0B0]">Patient</span> <span className="font-semibold text-[#030213]">{caseData.patientName}</span> <span className="font-mono text-[#A0A0B0]">{record.patient.csId}</span></span>
        <span className="inline-flex items-center gap-1"><Stethoscope className="w-3 h-3 text-[#A0A0B0]" />{caseData.dentist}</span>
        <span className="inline-flex items-center gap-1"><MapPin className="w-3 h-3 text-[#A0A0B0]" />{location?.name ?? caseData.practice}</span>
      </div>

      {step === 'choose' && (
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
          <button
            onClick={() => setStep('link')}
            className="text-left rounded-xl border border-[#E0E0E6] p-4 hover:border-[#4D8EF7] hover:shadow-md transition-all"
          >
            <span className="w-9 h-9 rounded-lg bg-[#EEF4FF] text-[#1565C0] flex items-center justify-center mb-3"><Link2 className="w-4 h-4" /></span>
            <p className="text-sm font-bold text-[#030213]">Link an Existing Appointment</p>
            <p className="text-xs text-[#717182] mt-1 leading-relaxed">An appointment already exists in CareStack for this patient — pick it and Smile Genius will associate it with the case.</p>
            {existing.length > 0 && <p className="text-[10px] font-semibold text-[#1565C0] mt-2">{existing.length} appointment{existing.length === 1 ? '' : 's'} on file</p>}
          </button>
          <button
            onClick={() => setStep('create')}
            className="text-left rounded-xl border border-[#E0E0E6] p-4 hover:border-[#4D8EF7] hover:shadow-md transition-all"
          >
            <span className="w-9 h-9 rounded-lg bg-[#ECFEFF] text-[#0F766E] flex items-center justify-center mb-3"><CalendarPlus className="w-4 h-4" /></span>
            <p className="text-sm font-bold text-[#030213]">Create New Appointment</p>
            <p className="text-xs text-[#717182] mt-1 leading-relaxed">Select the appointment details here and Smile Genius will create and link the appointment in CareStack.</p>
          </button>
        </div>
      )}

      {step === 'link' && (
        <div className="space-y-3">
          {record.appointment.requiredReason === 'ambiguous' && (
            <p className="text-[11px] text-[#B45309] bg-[#FFF8E1] border border-[#FDE68A] rounded-lg px-3 py-2">
              Smile Genius found more than one possible appointment and did not pick one automatically. Choose the correct appointment below.
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
                      {candidates.has(a.id) && (
                        <span className="inline-flex px-1.5 py-0.5 rounded-full text-[9px] font-bold uppercase tracking-wider bg-[#FFF8E1] text-[#B45309] border border-[#FDE68A]">Possible match</span>
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
