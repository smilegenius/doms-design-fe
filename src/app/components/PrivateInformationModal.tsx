import { useEffect, useState } from 'react';
import { X, Lock as LockIcon, Mail, Phone } from 'lucide-react';
import ModalPortal from './ModalPortal';
import { useToast } from '../context/ToastContext';
import {
  DentistPrivateInfo,
  PRIVATE_NOTES_MAX,
  getDentistPrivateInfo,
  saveDentistPrivateInfo,
} from '../data/dentistPrivateInfo';
import { isValidWhatsAppNumber } from '../data/whatsappComms';

// ─── Private Information ─────────────────────────────────────────────────────
// The lab's own contact record for a dentist: a direct email, a mobile number
// and free notes, none of which the dentist ever sees. Opened from the dentist
// on a case, and automatically when the lab tries to message a dentist it has
// no number for — the toast explains why, this is where the number goes in.
//
// z-[130] so it clears the Conversation drawer (z-[100]) and the status modal
// (z-[120]), the same layer UrgentConfirmModal uses.

interface Props {
  isOpen: boolean;
  dentist: string;
  onClose: () => void;
  /** Called after a successful save — e.g. to retry the send that opened it. */
  onSaved?: (info: DentistPrivateInfo) => void;
  /** Put the cursor in Private Phone No. — set when a missing number is why
      this opened, so the field that needs filling is the one that is focused. */
  focusField?: 'email' | 'phone' | 'notes';
}

function Field({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <div>
      <label className="block text-xs font-semibold text-[#030213] mb-1.5">{label}</label>
      {children}
    </div>
  );
}

const INPUT =
  'w-full pl-9 pr-3 py-2.5 text-sm border rounded-xl outline-none transition-colors placeholder:text-[#A0A0B0] ' +
  'border-[#E0E0E6] focus:border-[#4D8EF7] focus:ring-2 focus:ring-[#4D8EF7]/15';

export default function PrivateInformationModal({ isOpen, dentist, onClose, onSaved, focusField }: Props) {
  const { toast } = useToast();
  const [form, setForm] = useState<DentistPrivateInfo>({});
  const [touched, setTouched] = useState(false);

  // Re-read on open: the record may have changed since the last time this was
  // mounted, and a cancelled edit must not survive into the next open.
  useEffect(() => {
    if (!isOpen) return;
    setForm(getDentistPrivateInfo(dentist));
    setTouched(false);
  }, [isOpen, dentist]);

  if (!isOpen) return null;

  const phone = form.phone?.trim() ?? '';
  const email = form.email?.trim() ?? '';
  const notes = form.notes ?? '';
  // Both contact fields are optional — a lab may only want to keep notes — but
  // anything typed has to be usable, or the send it unblocks would fail later.
  const phoneInvalid = phone.length > 0 && !isValidWhatsAppNumber(phone);
  const emailInvalid = email.length > 0 && !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email);
  const canSave = !phoneInvalid && !emailInvalid;

  const handleSave = () => {
    setTouched(true);
    if (!canSave) return;
    saveDentistPrivateInfo(dentist, form);
    toast.success(`Private information saved for ${dentist}`);
    onSaved?.({ email: email || undefined, phone: phone || undefined, notes: notes.trim() || undefined });
    onClose();
  };

  return (
    <ModalPortal>
      <div className="fixed inset-0 z-[130] flex items-center justify-center p-4">
        <div className="absolute inset-0 bg-black/40 backdrop-blur-[2px]" onClick={onClose} />
        <div className="relative bg-white rounded-2xl shadow-2xl w-full max-w-lg max-h-[90vh] flex flex-col animate-in fade-in zoom-in-95">
          {/* Header */}
          <div className="px-6 pt-6 pb-4 flex-shrink-0">
            <button
              onClick={onClose}
              className="absolute top-4 right-4 w-8 h-8 rounded-lg flex items-center justify-center text-[#717182] hover:bg-[#F3F3F5] transition-colors"
              title="Close"
            >
              <X className="w-4 h-4" />
            </button>
            <h3 className="flex items-center justify-center gap-2 text-base font-semibold text-[#030213]">
              <LockIcon className="w-4 h-4 text-[#717182]" />
              Private Information
            </h3>
            <p className="text-xs text-[#717182] leading-relaxed text-center mt-1.5 max-w-sm mx-auto">
              Visible only to your lab. {dentist} cannot see these details, and they do not change the dentist&apos;s
              own contact information.
            </p>
          </div>

          {/* Fields */}
          <div className="px-6 pb-2 overflow-y-auto">
            <div className="rounded-2xl border border-[#E0E0E6] p-4 space-y-4">
              <Field label="Private Email">
                <div className="relative">
                  <Mail className="w-4 h-4 text-[#A0A0B0] absolute left-3 top-1/2 -translate-y-1/2 pointer-events-none" />
                  <input
                    autoFocus={focusField === 'email'}
                    value={form.email ?? ''}
                    onChange={(e) => setForm(f => ({ ...f, email: e.target.value }))}
                    placeholder="Enter private email"
                    className={`${INPUT} ${touched && emailInvalid ? '!border-[#FECACA] focus:!border-[#DC2626]' : ''}`}
                  />
                </div>
                {touched && emailInvalid && (
                  <p className="text-[11px] text-[#DC2626] mt-1">Enter a valid email address.</p>
                )}
              </Field>

              <Field label="Private Phone No.">
                <div className="relative">
                  <Phone className="w-4 h-4 text-[#A0A0B0] absolute left-3 top-1/2 -translate-y-1/2 pointer-events-none" />
                  <input
                    autoFocus={focusField === 'phone'}
                    value={form.phone ?? ''}
                    onChange={(e) => setForm(f => ({ ...f, phone: e.target.value }))}
                    placeholder="Enter private phone number"
                    className={`${INPUT} ${touched && phoneInvalid ? '!border-[#FECACA] focus:!border-[#DC2626]' : ''}`}
                  />
                </div>
                {touched && phoneInvalid ? (
                  <p className="text-[11px] text-[#DC2626] mt-1">Enter a valid phone number, e.g. +44 7700 900118.</p>
                ) : (
                  <p className="text-[11px] text-[#A0A0B0] mt-1">Used when the lab messages this dentist on WhatsApp.</p>
                )}
              </Field>

              <Field label="Private Notes">
                <textarea
                  autoFocus={focusField === 'notes'}
                  value={notes}
                  maxLength={PRIVATE_NOTES_MAX}
                  onChange={(e) => setForm(f => ({ ...f, notes: e.target.value }))}
                  placeholder={`Notes about this dentist — e.g. always call before 10am.`}
                  rows={4}
                  className="w-full px-3 py-2.5 text-sm border border-[#E0E0E6] rounded-xl outline-none transition-colors resize-y placeholder:text-[#A0A0B0] focus:border-[#4D8EF7] focus:ring-2 focus:ring-[#4D8EF7]/15"
                />
                <p className="text-[11px] text-[#A0A0B0] text-right mt-1 tabular-nums">
                  {notes.length} / {PRIVATE_NOTES_MAX}
                </p>
              </Field>
            </div>
          </div>

          {/* Actions */}
          <div className="flex items-center gap-3 px-6 py-5 flex-shrink-0">
            <button
              onClick={onClose}
              className="flex-1 px-4 py-2.5 rounded-xl text-sm font-semibold text-[#030213] bg-[#F8F9FC] border border-[#E0E0E6] hover:bg-[#F0EFF6] transition-colors"
            >
              Cancel
            </button>
            <button
              onClick={handleSave}
              className="flex-1 px-4 py-2.5 rounded-xl text-sm font-semibold text-white bg-gradient-to-r from-[#4D8EF7] to-[#A59DFF] hover:opacity-90 transition-opacity"
            >
              Save
            </button>
          </div>
        </div>
      </div>
    </ModalPortal>
  );
}
